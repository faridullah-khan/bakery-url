const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const config = functions.config() || {};
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || config.service?.project_id || config.firebase?.project_id;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || config.service?.client_email || config.firebase?.client_email;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY || config.service?.private_key || config.firebase?.private_key;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || config.app?.frontend_origin;

const hasServiceAccount = FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY;

if (!admin.apps.length) {
  const credential = hasServiceAccount
    ? admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      })
    : admin.credential.applicationDefault();

  admin.initializeApp({ credential });
}

const firestore = admin.firestore();
const inventoryCol = firestore.collection("inventory");
const recipesCol = firestore.collection("recipes");
const salesCol = firestore.collection("sales");

const app = express();
app.use(
  cors({
    origin: FRONTEND_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());

const buildItem = (id, data) => ({ id, ...data });
const toNumber = (value) => (Number.isFinite(value) ? value : 0);
const extractToken = (req) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  return null;
};

const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, role: decoded.role || decoded.customClaims?.role };
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Auth error", err);
    return res.status(401).json({ error: "Unauthorized", details: err.message });
  }
};

const requireRole = (allowedRoles) => async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = await admin.auth().verifyIdToken(token);
    const role = decoded.role || decoded.customClaims?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.user = { uid: decoded.uid, role };
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Role check error", err);
    res.status(401).json({ error: "Unauthorized", details: err.message });
  }
};

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Inventory read (cashier allowed)
app.get("/inventory", requireRole(["admin", "manager", "cashier"]), async (_req, res) => {
  try {
    const snapshot = await inventoryCol.get();
    const items = snapshot.docs.map((doc) => buildItem(doc.id, doc.data()));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inventory", details: err.message });
  }
});

// Inventory mutations (admin/manager)
app.post("/inventory", requireRole(["admin", "manager"]), async (req, res) => {
  try {
    const payload = req.body || {};
    const created = await inventoryCol.add(payload);
    const doc = await created.get();
    res.status(201).json(buildItem(doc.id, doc.data()));
  } catch (err) {
    res.status(500).json({ error: "Failed to create inventory item", details: err.message });
  }
});

app.put("/inventory/:id", requireRole(["admin", "manager"]), async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = inventoryCol.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Item not found" });
    }
    await docRef.set(req.body || {}, { merge: true });
    const updated = await docRef.get();
    res.json(buildItem(updated.id, updated.data()));
  } catch (err) {
    res.status(500).json({ error: "Failed to update inventory item", details: err.message });
  }
});

app.delete("/inventory/:id", requireRole(["admin", "manager"]), async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = inventoryCol.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Item not found" });
    }
    await docRef.delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete inventory item", details: err.message });
  }
});

// Recipe cost
app.get("/recipes/:productId/cost", requireRole(["admin", "manager"]), async (req, res) => {
  const { productId } = req.params;
  try {
    const recipeDoc = await recipesCol.doc(productId).get();
    if (!recipeDoc.exists) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const recipe = recipeDoc.data() || {};
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

    const breakdown = await Promise.all(
      ingredients.map(async (ing) => {
        const { ingredientId, quantity } = ing;
        if (!ingredientId) {
          return { ingredientId: null, quantity: toNumber(quantity), price: 0, cost: 0 };
        }
        const invDoc = await inventoryCol.doc(ingredientId).get();
        if (!invDoc.exists) {
          return { ingredientId, missing: true, quantity: toNumber(quantity), price: 0, cost: 0 };
        }
        const inv = invDoc.data() || {};
        const price = toNumber(inv.price);
        const qty = toNumber(quantity);
        const cost = price * qty;
        return { ingredientId, quantity: qty, price, cost };
      })
    );

    const totalCost = breakdown.reduce((sum, row) => sum + toNumber(row.cost), 0);

    res.json({ productId, totalCost, breakdown });
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate recipe cost", details: err.message });
  }
});

// Recipes CRUD
app.get("/recipes/:productId", requireRole(["admin", "manager"]), async (req, res) => {
  const { productId } = req.params;
  try {
    const doc = await recipesCol.doc(productId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recipe", details: err.message });
  }
});

app.put("/recipes/:productId", requireRole(["admin", "manager"]), async (req, res) => {
  const { productId } = req.params;
  const payload = req.body || {};
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];

  try {
    const cleanIngredients = ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      quantity: toNumber(parseFloat(ing.quantity)),
    }));

    await recipesCol.doc(productId).set(
      {
        ingredients: cleanIngredients,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const updated = await recipesCol.doc(productId).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: "Failed to save recipe", details: err.message });
  }
});

// POS flow: sales
app.post("/sale", requireAuth, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  try {
    const result = await firestore.runTransaction(async (tx) => {
      let totalPrice = 0;
      let totalCost = 0;
      const saleItems = [];

      for (const item of items) {
        const productId = item.productId;
        const qty = toNumber(parseFloat(item.quantity));
        const price = toNumber(parseFloat(item.price));
        const name = item.name || productId;
        const unitType = item.unitType || "unit";

        if (!productId || qty <= 0) {
          throw new Error("Each item needs productId and positive quantity");
        }

        const recipeRef = recipesCol.doc(productId);
        const recipeSnap = await tx.get(recipeRef);
        if (!recipeSnap.exists) {
          throw new Error(`Recipe not found for product ${productId}`);
        }

        const recipe = recipeSnap.data() || {};
        const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

        let costPerUnit = 0;

        for (const ing of ingredients) {
          const ingId = ing.ingredientId;
          const ingQty = toNumber(parseFloat(ing.quantity)) * qty;
          if (!ingId) continue;

          const invRef = inventoryCol.doc(ingId);
          const invSnap = await tx.get(invRef);
          if (!invSnap.exists) {
            throw new Error(`Ingredient ${ingId} missing in inventory`);
          }

          const inv = invSnap.data() || {};
          const currentQty = toNumber(parseFloat(inv.quantity));
          const nextQty = currentQty - ingQty;
          if (nextQty < 0) {
            throw new Error(`Insufficient stock for ingredient ${ingId}`);
          }

          const ingPrice = toNumber(parseFloat(inv.price));
          costPerUnit += toNumber(parseFloat(ing.quantity)) * ingPrice;

          tx.set(invRef, { quantity: nextQty }, { merge: true });
        }

        const costPKR = costPerUnit * qty;
        const lineTotal = qty * price;
        totalPrice += lineTotal;
        totalCost += costPKR;

        saleItems.push({
          productId,
          name,
          unitType,
          quantity: qty,
          pricePKR: price,
          costPKR,
          lineTotalPKR: lineTotal,
        });
      }

      const sale = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        items: saleItems,
        totalPKR: totalPrice,
        costTotalPKR: totalCost,
        cashier: req.user?.uid || null,
      };

      const saleRef = salesCol.doc();
      tx.set(saleRef, sale);

      return { id: saleRef.id, ...sale };
    });

    res.status(201).json(result);
  } catch (err) {
    const status = err?.message?.toLowerCase().includes("unauthorized") ? 401 : 400;
    res.status(status).json({ error: "Failed to process sale", details: err.message });
  }
});

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

exports.api = functions.https.onRequest(app);

