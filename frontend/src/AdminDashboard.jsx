import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : import.meta.env.VITE_API_BASE_URL;
const formatPKR = (value) => value.toLocaleString("en-PK", { style: "currency", currency: "PKR" });

function useAutoFocus(open) {
  const ref = useRef(null);
  useEffect(() => {
    if (open && ref.current) {
      ref.current.focus();
      ref.current.select?.();
    }
  }, [open]);
  return ref;
}

function Alert({ message, onRetry }) {
  if (!message) return null;
  return (
    <div style={{ background: "#fff5f5", border: "1px solid #f0d6d6", color: "#a83232", padding: 12, borderRadius: 8, marginBottom: 12 }}>
      <span>{message}</span>
      {onRetry && (
        <button style={{ marginLeft: 10 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

function Modal({ open, title, onClose, onConfirm, children, confirmLabel = "Save" }) {
  const firstInputRef = useAutoFocus(open);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onConfirm();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;
  return (
    <div style={backdropStyle}>
      <div style={modalStyle} onKeyDown={handleKeyDown}>
        <div style={modalHeaderStyle}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {typeof children === "function" ? children(firstInputRef) : children}
        </div>
        <div style={modalActionsStyle}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle = {
  background: "#ffffff",
  borderRadius: 12,
  border: "1px solid #e5e1d8",
  padding: 16,
  minWidth: 340,
  maxWidth: "90vw",
  boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
};

const modalHeaderStyle = { fontWeight: 700, marginBottom: 10 };
const modalActionsStyle = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 };

export function InventoryAdminPage() {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", quantity: "" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInventoryItems(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", price: "", quantity: "" });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name || "", price: item.price ?? "", quantity: item.quantity ?? "" });
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setSaving(false);
    setForm({ name: "", price: "", quantity: "" });
    setEditingId(null);
  };

  const saveIngredient = async () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    const quantity = parseFloat(form.quantity);
    if (!name || Number.isNaN(price) || Number.isNaN(quantity) || price < 0 || quantity < 0) return;
    setSaving(true);
    try {
      const payload = { name, price, quantity };
      if (editingId) {
        const res = await fetch(`${API_BASE_URL}/inventory/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        setInventoryItems((prev) => prev.map((it) => (it.id === editingId ? { ...it, ...payload } : it)));
      } else {
        const res = await fetch(`${API_BASE_URL}/inventory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        const created = await res.json();
        setInventoryItems((prev) => [...prev, created]);
      }
      resetModal();
    } catch {
      setSaving(false);
      setError(true);
    }
  };

  const removeIngredient = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setInventoryItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError(true);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Alert message={error ? "Failed to fetch inventory" : ""} onRetry={fetchInventory} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <button onClick={openAdd}>Add Ingredient</button>
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : inventoryItems.length === 0 ? (
        <div>No ingredients yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Price (PKR)</th>
              <th style={th}>Quantity</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.map((item) => (
              <tr key={item.id}>
                <td style={td}>{item.name}</td>
                <td style={td}>{formatPKR(item.price || 0)}</td>
                <td style={td}>{item.quantity ?? 0}</td>
                <td style={td}>
                  <button onClick={() => openEdit(item)}>Edit</button>
                  <button onClick={() => removeIngredient(item.id)} style={{ marginLeft: 8 }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? "Edit Ingredient" : "Add Ingredient"}
        onClose={resetModal}
        onConfirm={saveIngredient}
        confirmLabel={saving ? "Saving…" : "Save"}
      >
        {(ref) => (
          <>
            <input
              ref={ref}
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="number"
              placeholder="Price (PKR)"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              step="0.01"
              min="0"
            />
            <input
              type="number"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              step="0.01"
              min="0"
            />
          </>
        )}
      </Modal>
    </div>
  );
}

export function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", ingredients: [] });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchRecipes = async () => {
    setLoading(true);
    setError(false);
    try {
      const [recipesRes, invRes] = await Promise.all([
        fetch(`${API_BASE_URL}/recipes`),
        fetch(`${API_BASE_URL}/inventory`),
      ]);
      if (!recipesRes.ok || !invRes.ok) throw new Error("Failed");
      const recipesData = await recipesRes.json();
      const invData = await invRes.json();
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
      setInventoryItems(Array.isArray(invData) ? invData : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", price: "", ingredients: [] });
    setModalOpen(true);
  };

  const openEdit = (recipe) => {
    setEditingId(recipe.id);
    const mapped = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ing) => ({ ingredientId: ing.ingredientId, quantity: ing.quantity }))
      : [];
    setForm({ name: recipe.name || "", price: recipe.price ?? "", ingredients: mapped });
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setSaving(false);
    setForm({ name: "", price: "", ingredients: [] });
    setEditingId(null);
  };

  const toggleIngredient = (id) => {
    setForm((prev) => {
      const exists = prev.ingredients.find((ing) => ing.ingredientId === id);
      if (exists) {
        return { ...prev, ingredients: prev.ingredients.filter((ing) => ing.ingredientId !== id) };
      }
      return { ...prev, ingredients: [...prev.ingredients, { ingredientId: id, quantity: "" }] };
    });
  };

  const updateIngredientQty = (id, qty) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.ingredientId === id ? { ...ing, quantity: qty } : ing
      ),
    }));
  };

  const saveRecipe = async () => {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    const cleanIngredients = form.ingredients
      .map((ing) => ({ ...ing, quantity: parseFloat(ing.quantity) }))
      .filter((ing) => ing.ingredientId && Number.isFinite(ing.quantity) && ing.quantity > 0);
    if (!name || Number.isNaN(price) || price < 0 || cleanIngredients.length === 0) return;
    setSaving(true);
    try {
      const payload = { name, price, ingredients: cleanIngredients };
      if (editingId) {
        const res = await fetch(`${API_BASE_URL}/recipes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        setRecipes((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r)));
      } else {
        const res = await fetch(`${API_BASE_URL}/recipes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        const created = await res.json();
        setRecipes((prev) => [...prev, created]);
      }
      resetModal();
    } catch {
      setSaving(false);
      setError(true);
    }
  };

  const removeRecipe = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/recipes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(true);
    }
  };

  const ingredientName = useMemo(
    () => Object.fromEntries(inventoryItems.map((ing) => [ing.id, ing.name])),
    [inventoryItems]
  );

  return (
    <div style={{ padding: 16 }}>
      <Alert message={error ? "Failed to fetch recipes" : ""} onRetry={fetchRecipes} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Recipes</h2>
        <button onClick={openAdd}>Add Recipe</button>
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : recipes.length === 0 ? (
        <div>No recipes yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Price (PKR)</th>
              <th style={th}>Ingredients</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe) => (
              <tr key={recipe.id}>
                <td style={td}>{recipe.name}</td>
                <td style={td}>{formatPKR(recipe.price || 0)}</td>
                <td style={td}>
                  {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
                    ? recipe.ingredients.map((ing) => `${ingredientName[ing.ingredientId] || ing.ingredientId}: ${ing.quantity}`).join(", ")
                    : "—"}
                </td>
                <td style={td}>
                  <button onClick={() => openEdit(recipe)}>Edit</button>
                  <button onClick={() => removeRecipe(recipe.id)} style={{ marginLeft: 8 }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? "Edit Recipe" : "Add Recipe"}
        onClose={resetModal}
        onConfirm={saveRecipe}
        confirmLabel={saving ? "Saving…" : "Save"}
      >
        {(ref) => (
          <>
            <input
              ref={ref}
              placeholder="Recipe Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="number"
              placeholder="Price (PKR)"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              step="0.01"
              min="0"
            />
            <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid #e5e1d8", padding: 8, borderRadius: 8 }}>
              {inventoryItems.length === 0 ? (
                <div style={{ color: "#8b8476" }}>No ingredients available.</div>
              ) : (
                inventoryItems.map((ing) => {
                  const selected = form.ingredients.find((i) => i.ingredientId === ing.id);
                  return (
                    <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() => toggleIngredient(ing.id)}
                        aria-label={`Select ${ing.name}`}
                      />
                      <span style={{ flex: 1 }}>{ing.name}</span>
                      {selected && (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Qty"
                          value={selected.quantity}
                          onChange={(e) => updateIngredientQty(ing.id, e.target.value)}
                          style={{ width: 90 }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

const th = { textAlign: "left", borderBottom: "1px solid #e5e1d8", padding: "8px 6px" };
const td = { borderBottom: "1px solid #f0ece3", padding: "8px 6px" };

export default function AdminDashboard() {
  return (
    <div style={{ display: "grid", gap: 32 }}>
      <InventoryAdminPage />
      <RecipesPage />
    </div>
  );
}

