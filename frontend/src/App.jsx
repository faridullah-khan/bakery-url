import { useEffect, useMemo, useState } from "react";
import "./App.css";

const seedProducts = [
  { id: "croissant", name: "Butter Croissant", price: 2.5, sellBy: "unit" },
  { id: "baguette", name: "Fresh Baguette", price: 3, sellBy: "unit" },
  { id: "cinnamon", name: "Cinnamon Roll", price: 3.25, sellBy: "unit" },
  { id: "muffin", name: "Blueberry Muffin", price: 2.25, sellBy: "unit" },
  { id: "sourdough", name: "Sourdough Loaf", price: 4.75, sellBy: "weight" },
  { id: "cookie", name: "Chocolate Chip Cookie", price: 1.75, sellBy: "unit" },
  { id: "tart", name: "Fruit Tart", price: 5.5, sellBy: "unit" },
  { id: "brownie", name: "Walnut Brownie", price: 2.75, sellBy: "unit" },
];

const STEP = 0.1;
const API_BASE_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : import.meta.env.VITE_API_BASE_URL;

const PKR = (value) => value.toLocaleString("en-PK", { style: "currency", currency: "PKR" });

const formatCurrency = PKR;

// Environment logging
if (typeof window !== "undefined") {
  const mode = window.location.hostname === "localhost" ? "development" : "production";
  // eslint-disable-next-line no-console
  console.log(`Running in ${mode} mode`);
  // eslint-disable-next-line no-console
  console.log(`API_BASE_URL: ${API_BASE_URL}`);
}

function ProductCard({ product, onAdd, showPrice }) {
  return (
    <button className="product-card" onClick={() => onAdd(product)}>
      <span className="product-name">{product.name}</span>
      {product.sellBy === "weight" && <span className="weight-badge">kg</span>}
      {showPrice ? (
        <span className="product-price">{formatCurrency(product.price)}</span>
      ) : (
        <span className="product-price muted">Tap to add</span>
      )}
    </button>
  );
}

function CartItem({ item, onChange, onInputChange, onRemove, costPerUnit }) {
  const subtotal = item.price * item.qty;
  const costLine = (costPerUnit || 0) * item.qty;
  const unitLabel = item.sellBy === "weight" ? "kg" : "pcs";

  return (
    <div className="cart-item">
      <div>
        <div className="cart-item-name">
          {item.name} <span className="unit-chip">{unitLabel}</span>
        </div>
        <div className="cart-item-price">Price: {formatCurrency(item.price)} / {unitLabel}</div>
      </div>
      <div className="cart-controls">
        <button aria-label="Decrease quantity" onClick={() => onChange(item.id, -1)}>
          -
        </button>
        <input
          type="number"
          step={STEP}
          min="0"
          value={item.qty}
          className="qty-input"
          onChange={(e) => onInputChange(item.id, e.target.value)}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <button aria-label="Increase quantity" onClick={() => onChange(item.id, 1)}>
          +
        </button>
      </div>
      <div className="cart-subtotal">Line Total: {formatCurrency(subtotal)}</div>
      <div className="cart-cost-per-unit">Cost/Unit: {formatCurrency(costPerUnit || 0)}</div>
      <div className="cart-cost-line">Cost Total: {formatCurrency(costLine)}</div>
      <button className="remove-btn" onClick={() => onRemove(item.id)}>
        Remove
      </button>
    </div>
  );
}

function InventoryAdmin({ role, token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", price: "", quantity: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({ name: "", price: "", quantity: "" });

  const isAuthorized = role === "admin" || role === "manager";

  const authHeaders = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  const fetchInventory = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError("");
    try {
      const url = `${API_BASE_URL}/inventory`;
      // eslint-disable-next-line no-console
      console.log(`GET ${url}`);
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Inventory fetch error", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, token]);

  const resetForm = () => setForm({ name: "", price: "", quantity: "" });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: form.name,
          price: parseFloat(form.price),
          quantity: parseFloat(form.quantity),
        }),
      });
      if (!res.ok) throw new Error("Failed to create ingredient");
      resetForm();
      fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingData({
      name: item.name || "",
      price: item.price ?? "",
      quantity: item.quantity ?? "",
    });
  };

  const submitEdit = async (id) => {
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          name: editingData.name,
          price: parseFloat(editingData.price),
          quantity: parseFloat(editingData.quantity),
        }),
      });
      if (!res.ok) throw new Error("Failed to update ingredient");
      setEditingId(null);
      fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeItem = async (id) => {
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to delete ingredient");
      fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isAuthorized) {
    return <div className="panel admin-panel"><div className="panel-header">Inventory</div><div className="panel-body"><p>Access denied. Admin or manager role required.</p></div></div>;
  }

  return (
    <div className="admin-panel panel">
      <div className="panel-header">Inventory Management</div>
      <div className="panel-body">
        <form className="inventory-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Quantity"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
          />
          <button type="submit" disabled={loading}>Add Ingredient</button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="inventory-table">
          <div className="inventory-row inventory-head">
            <span>Name</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <div className="inventory-row">Loading...</div>
          ) : items.length === 0 ? (
            <div className="inventory-row">No ingredients yet.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="inventory-row">
                {editingId === item.id ? (
                  <>
                    <input
                      type="text"
                      value={editingData.name}
                      onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editingData.price}
                      onChange={(e) => setEditingData({ ...editingData, price: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editingData.quantity}
                      onChange={(e) => setEditingData({ ...editingData, quantity: e.target.value })}
                    />
                    <div className="actions">
                      <button type="button" onClick={() => submitEdit(item.id)}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.price || 0)}</span>
                    <span>{item.quantity ?? 0}</span>
                    <div className="actions">
                      <button type="button" onClick={() => startEdit(item)}>Edit</button>
                      <button type="button" onClick={() => removeItem(item.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RecipeEditor({ role, token, products }) {
  const [inventory, setInventory] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isAuthorized = role === "admin" || role === "manager";

  const authHeaders = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  const fetchInventory = async () => {
    if (!isAuthorized) return;
    setError("");
    try {
      const url = `${API_BASE_URL}/inventory`;
      // eslint-disable-next-line no-console
      console.log(`GET ${url}`);
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load inventory");
      const data = await res.json();
      setInventory(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Inventory fetch error", err);
      setError(err.message);
    }
  };

  const fetchRecipe = async (productId) => {
    if (!isAuthorized || !productId) return;
    setLoading(true);
    setError("");
    try {
      const url = `${API_BASE_URL}/recipes/${productId}`;
      // eslint-disable-next-line no-console
      console.log(`GET ${url}`);
      const res = await fetch(url, { headers: authHeaders });
      if (res.status === 404) {
        setIngredients([]);
        setError("Requested resource not found. Please try again.");
        // eslint-disable-next-line no-console
        console.error("Recipe fetch 404", { url });
        return;
      }
      if (!res.ok) throw new Error("Failed to load recipe");
      const data = await res.json();
      setIngredients(Array.isArray(data.ingredients) ? data.ingredients : []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Recipe fetch error", err);
      setError(err.message);
      setIngredients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, token]);

  useEffect(() => {
    if (selectedProduct) fetchRecipe(selectedProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, role, token]);

  const updateIngredient = (index, patch) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addIngredientRow = () => {
    const firstId = inventory[0]?.id || "";
    setIngredients((prev) => [...prev, { ingredientId: firstId, quantity: "" }]);
  };

  const removeIngredientRow = (index) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const lines = useMemo(() => {
    return ingredients.map((ing) => {
      const inv = inventory.find((i) => i.id === ing.ingredientId);
      const price = inv?.price || 0;
      const qty = parseFloat(ing.quantity) || 0;
      const cost = price * qty;
      return { ...ing, price, qty, cost };
    }, []);
  }, [ingredients, inventory]);

  const totalCost = useMemo(
    () => lines.reduce((sum, line) => sum + line.cost, 0),
    [lines]
  );

  const saveRecipe = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ingredients: ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          quantity: parseFloat(ing.quantity) || 0,
        })),
      };
      const res = await fetch(`${API_BASE_URL}/recipes/${selectedProduct}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save recipe");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="panel admin-panel">
        <div className="panel-header">Recipes</div>
        <div className="panel-body">Access denied. Admin or manager role required.</div>
      </div>
    );
  }

  return (
    <div className="panel admin-panel">
      <div className="panel-header">Recipe Editor</div>
      <div className="panel-body">
        <div className="recipe-top">
          <label className="mode-toggle">
            <span>Product</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="cost-chip">Cost price: {formatCurrency(totalCost)}</div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="inventory-table recipe-table">
          <div className="inventory-row inventory-head">
            <span>Ingredient</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Cost</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <div className="inventory-row">Loading...</div>
          ) : lines.length === 0 ? (
            <div className="inventory-row">No ingredients. Add one below.</div>
          ) : (
            lines.map((line, idx) => (
              <div key={idx} className="inventory-row recipe-row">
                <select
                  value={line.ingredientId}
                  onChange={(e) => updateIngredient(idx, { ingredientId: e.target.value })}
                >
                  {inventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                />
                <span>{formatCurrency(line.price || 0)}</span>
                <span>{formatCurrency(line.cost || 0)}</span>
                <div className="actions">
                  <button type="button" onClick={() => removeIngredientRow(idx)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="recipe-actions">
          <button type="button" onClick={addIngredientRow} disabled={inventory.length === 0}>
            Add ingredient
          </button>
          <button type="button" onClick={saveRecipe} disabled={saving || !selectedProduct}>
            {saving ? "Saving..." : "Save recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [products] = useState(seedProducts);
  const [cart, setCart] = useState({});
  const [cashierMode, setCashierMode] = useState(false);
  const [role, setRole] = useState("cashier");
  const [authToken, setAuthToken] = useState("");
  const [activeTab, setActiveTab] = useState("pos");
  const [quantityModal, setQuantityModal] = useState({ open: false, product: null, value: "", error: "" });
  const [costMap, setCostMap] = useState({});
  const [saleState, setSaleState] = useState({ loading: false, error: "", info: "", retry: false });
  const [confirmSaleOpen, setConfirmSaleOpen] = useState(false);

  const quantityStep = quantityModal.product?.sellBy === "weight" ? STEP : 1;
  const quantityMin = quantityModal.product?.sellBy === "weight" ? STEP : 1;

  useEffect(() => {
    let cancelled = false;
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const load = async () => {
      const entries = await Promise.all(
        products.map(async (p) => {
          try {
            const res = await fetch(`${API_BASE_URL}/recipes/${p.id}/cost`, { headers });
            if (!res.ok) return [p.id, 0];
            const data = await res.json();
            return [p.id, data.totalCost || 0];
          } catch {
            return [p.id, 0];
          }
         })
       );
       if (!cancelled) {
         setCostMap(Object.fromEntries(entries));
       }
     };
     load();
     return () => {
       cancelled = true;
     };
  }, [products, authToken]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cartItems]
  );

  const costTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (costMap[item.id] || 0) * item.qty, 0),
    [cartItems, costMap]
  );

  const addToCart = (product, qty) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        qty: roundToStep((prev[product.id]?.qty || 0) + qty),
      },
    }));
  };

  const openQuantityModal = (product) => {
    const defaultValue = product.sellBy === "weight" ? "0.5" : "1";
    setQuantityModal({ open: true, product, value: defaultValue, error: "" });
  };

  const closeQuantityModal = () => setQuantityModal({ open: false, product: null, value: "", error: "" });

  const confirmQuantity = () => {
    const { product, value } = quantityModal;
    if (!product) return;
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return setQuantityModal((prev) => ({ ...prev, error: "Enter a valid quantity greater than 0" }));
    }

    if (product.sellBy === "weight") {
      const rounded = Math.round(parsed * 10) / 10;
      addToCart(product, rounded);
      closeQuantityModal();
      return;
    }

    const whole = Math.floor(parsed);
    if (whole <= 0) {
      return setQuantityModal((prev) => ({ ...prev, error: "Enter a whole number greater than 0" }));
    }
    addToCart(product, whole);
    closeQuantityModal();
  };

  const changeQty = (id, delta) => {
    setCart((prev) => {
      const item = prev[id];
      if (!item) return prev;
      const nextQty = roundToStep(item.qty + delta);
      if (nextQty <= 0) {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      }
      return { ...prev, [id]: { ...item, qty: nextQty } };
    });
  };

  const handleInputQty = (id, value) => {
    const numeric = roundToStep(parseFloat(value) || 0);
    setCart((prev) => {
      const item = prev[id];
      if (!item) return prev;
      if (numeric <= 0) {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      }
      return { ...prev, [id]: { ...item, qty: numeric } };
    });
  };

  const removeItem = (id) => {
    setCart((prev) => {
      const clone = { ...prev };
      delete clone[id];
      return clone;
    });
  };

  const roundToStep = (value) => Math.round(value / STEP) * STEP;

  const checkout = async () => {
    if (cartItems.length === 0) return;
    if (!authToken) {
      setSaleState({ loading: false, error: "Session expired, please log in again.", info: "", retry: true });
      return;
    }
    setSaleState({ loading: true, error: "", info: "", retry: false });
    const items = cartItems.map((item) => ({
      productId: item.id,
      quantity: item.qty,
      price: item.price,
      name: item.name,
      unitType: item.sellBy,
     }));

     try {
      const headers = { "Content-Type": "application/json" };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const url = `${API_BASE_URL}/sale`;
      // eslint-disable-next-line no-console
      console.log(`POST ${url}`);
      const res = await fetch(url, {
         method: "POST",
         headers,
         body: JSON.stringify({ items }),
       });

       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         const is401 = res.status === 401;
         const is404 = res.status === 404;
         const message = is401 ? "Session expired, please log in again." : data.error || data.details || "Checkout failed";
         const friendly = is404 ? "Requested resource not found. Please try again." : message;
         // eslint-disable-next-line no-console
        console.error("Checkout failed", { status: res.status, details: data, url });
        setSaleState({ loading: false, error: friendly, info: "", retry: is401 });
         return;
       }

       setSaleState({ loading: false, error: "", info: "Sale completed", retry: false });
       setCart({});
       setConfirmSaleOpen(false);
     } catch (err) {
       // eslint-disable-next-line no-console
      console.error("Checkout error", err);
       setSaleState({ loading: false, error: err.message || "Checkout failed", info: "", retry: true });
     }
   };

  return (
    <div className="pos-shell">
      <header className="pos-header">
        <div>
          <div className="headline">Macaron Bakers</div>
          <div className="subhead">Tap an item to add it to the cart</div>
        </div>
        <div className="header-actions">
          <label className="mode-toggle">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
            </select>
          </label>
          <label className="mode-toggle">
            <span>Cashier mode</span>
            <input
              type="checkbox"
              checked={cashierMode}
              onChange={(e) => setCashierMode(e.target.checked)}
            />
          </label>
          <input
            className="token-input"
            placeholder="Bearer token (Firebase ID token)"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
          />
          <div className="pill">{itemCount} item{itemCount === 1 ? "" : "s"}</div>
        </div>
      </header>

      <div className="tabs">
        <button
          className={activeTab === "pos" ? "tab active" : "tab"}
          onClick={() => setActiveTab("pos")}
        >
          POS
        </button>
        <button
          className={activeTab === "inventory" ? "tab active" : "tab"}
          onClick={() => setActiveTab("inventory")}
          disabled={role === "cashier"}
        >
          Inventory Admin
        </button>
        <button
          className={activeTab === "recipes" ? "tab active" : "tab"}
          onClick={() => setActiveTab("recipes")}
          disabled={role === "cashier"}
        >
          Recipes
        </button>
      </div>

      {activeTab === "pos" ? (
        <div className="pos-body">
          <section className="panel product-panel">
            <div className="panel-header">Products</div>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={openQuantityModal}
                  showPrice={!cashierMode}
                />
              ))}
            </div>
          </section>

          <aside className="panel cart-panel">
            <div className="panel-header">Cart</div>
            <div className="cart-list">
              {cartItems.length === 0 ? (
                <p className="empty">No items yet. Add pastries from the left.</p>
              ) : (
                cartItems.map((item) => (
                  <CartItem
                    key={item.id}
                    item={item}
                    onChange={changeQty}
                    onInputChange={handleInputQty}
                    onRemove={removeItem}
                    costPerUnit={costMap[item.id] || 0}
                  />
                ))
              )}
            </div>

            <div className="cart-footer">
              {saleState.error && <div className="error-banner">{saleState.error}</div>}
              {saleState.retry && !saleState.loading && (
                <button className="checkout-btn" onClick={checkout}>
                  Retry
                </button>
              )}
              {saleState.info && <div className="cost-chip">{saleState.info}</div>}
              {saleState.loading && <div className="cost-chip">Processing sale…</div>}
                <div className="total-row">
                  <span>Grand Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="total-row muted">
                  <span>Cost Total</span>
                  <span>{formatCurrency(costTotal)}</span>
                </div>
               <button
                 className="checkout-btn"
                 disabled={cartItems.length === 0 || saleState.loading}
                 onClick={() => setConfirmSaleOpen(true)}
               >
                {saleState.loading ? "Processing..." : "Checkout"}
               </button>
             </div>
          </aside>
        </div>
      ) : activeTab === "inventory" ? (
        <div className="admin-body">
          <InventoryAdmin role={role} token={authToken} />
        </div>
      ) : (
        <div className="admin-body">
          <RecipeEditor role={role} token={authToken} products={products} />
        </div>
      )}

      {quantityModal.open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">Enter Quantity</div>
            <div className="modal-body">
              <div className="modal-product">{quantityModal.product?.name}</div>
              <input
                type="number"
                step={quantityStep}
                min={quantityMin}
                value={quantityModal.value}
                onChange={(e) =>
                  setQuantityModal((prev) => ({ ...prev, value: e.target.value, error: "" }))
                }
              />
              {quantityModal.error && <div className="error-banner">{quantityModal.error}</div>}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={closeQuantityModal}>Cancel</button>
              <button type="button" onClick={confirmQuantity}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {confirmSaleOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">Confirm Sale</div>
            <div className="modal-body">
              <div className="modal-product">Confirm sale of {itemCount} item{itemCount === 1 ? "" : "s"}?</div>
              <div className="modal-product">Total: {formatCurrency(total)}</div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmSaleOpen(false)}>Cancel</button>
              <button type="button" onClick={checkout}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
