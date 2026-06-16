// App.js — LTCE con Supabase
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bmmoqcdtrehtcgxzbhth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbW9xY2R0cmVodGNneHpiaHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTUzNjMsImV4cCI6MjA5NjgzMTM2M30.ya0MRCMioCQmnJWCKEEF0njM3E1VJYgISqhGDIPfofc";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const SLOTS = ["08:00–10:00","10:00–12:00","12:00–14:00","14:00–16:00","16:00–18:00"];
const today = new Date();
const fmt = (d) => d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
const DAYS = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });

const STATUS_STYLE = {
  available: { bg: "#EAF3DE", color: "#3B6D11", label: "Disponibile" },
  maintenance: { bg: "#FAEEDA", color: "#854F0B", label: "Manutenzione" },
};

const CAT_COLORS = {
  "Cromatografia": "#7F77DD", "Ottica": "#178BCA", "Analisi elementare": "#1D9E75",
  "Biologia Molecolare": "#1D9E75", "Imaging": "#D4537E", "Pesatura": "#888780",
};

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
function InventoryPage({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("reagenti");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Reagente", quantity: "", unit: "", min_quantity: "", status: "available", notes: "" });
  const [amount, setAmount] = useState("");

  useEffect(() => {
    supabase.from("inventory").select("*").order("category").then(({ data }) => {
      setItems(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = items.filter(i => {
    const matchTab = tab === "reagenti" ? i.category === "Reagente" : i.category === "Bombola";
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.notes || "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const STATUS = {
    available: { bg: "#EAF3DE", color: "#3B6D11", label: "Disponibile" },
    low: { bg: "#FAEEDA", color: "#854F0B", label: "Scorta bassa" },
    exhausted: { bg: "#FAECE7", color: "#A32D2D", label: "Esaurito" },
    full: { bg: "#EAF3DE", color: "#3B6D11", label: "Piena" },
    partial: { bg: "#FAEEDA", color: "#854F0B", label: "Parziale" },
    empty: { bg: "#FAECE7", color: "#A32D2D", label: "Vuota" },
  };

  const getStatus = (item) => {
    if (item.category === "Bombola") return STATUS[item.status] || STATUS.available;
    if (item.quantity === 0) return STATUS.exhausted;
    if (item.min_quantity > 0 && item.quantity <= item.min_quantity) return STATUS.low;
    return STATUS.available;
  };

  const addItem = async () => {
    if (!form.name.trim()) return alert("Inserisci il nome!");
    const { data, error } = await supabase.from("inventory").insert([{
      ...form, quantity: +form.quantity, min_quantity: +form.min_quantity, updated_by: currentUser.name
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setItems(prev => [...prev, data]);
    setModal(null);
    setForm({ name: "", category: "Reagente", quantity: "", unit: "", min_quantity: "", status: "available", notes: "" });
  };

  const updateQuantity = async (type) => {
    const delta = type === "load" ? +amount : -amount;
    const newQty = Math.max(0, selected.quantity + delta);
    const newStatus = newQty === 0 ? "exhausted" : "available";
    const { data, error } = await supabase.from("inventory").update({
      quantity: newQty, status: newStatus, updated_by: currentUser.name, updated_at: new Date()
    }).eq("id", selected.id).select().single();
    if (error) return alert("Errore: " + error.message);
    setItems(prev => prev.map(i => i.id === selected.id ? data : i));
    setModal(null);
    setAmount("");
  };

  const updateStatus = async (id, status) => {
    const { data, error } = await supabase.from("inventory").update({
      status, updated_by: currentUser.name, updated_at: new Date()
    }).eq("id", id).select().single();
    if (error) return alert("Errore: " + error.message);
    setItems(prev => prev.map(i => i.id === id ? data : i));
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Vuoi eliminare questo elemento?")) return;
    await supabase.from("inventory").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Caricamento...</div>;

  return (
    <div>
      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("reagenti")} style={{
          flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "reagenti" ? "#1D9E75" : "#f0f0f0",
          color: tab === "reagenti" ? "#fff" : "#555",
          fontWeight: tab === "reagenti" ? 600 : 400, fontSize: 14
        }}>🧪 Reagenti</button>
        <button onClick={() => setTab("bombole")} style={{
          flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "bombole" ? "#178BCA" : "#f0f0f0",
          color: tab === "bombole" ? "#fff" : "#555",
          fontWeight: tab === "bombole" ? 600 : 400, fontSize: 14
        }}>🫧 Bombole Gas</button>
      </div>

      {/* Search + Aggiungi */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cerca..."
          style={{ flex: 1, fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "0.5px solid #ccc" }} />
        <button onClick={() => setModal("add")} style={{
          fontSize: 12, padding: "7px 14px", borderRadius: 6, border: "none",
          background: "#7F77DD", color: "#fff", cursor: "pointer", whiteSpace: "nowrap"
        }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Aggiungi
        </button>
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0
          ? <p style={{ fontSize: 13, color: "#aaa" }}>Nessun elemento trovato</p>
          : filtered.map(item => {
              const st = getStatus(item);
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.8rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {item.category === "Reagente"
                        ? <span>Quantità: <b>{item.quantity} {item.unit}</b>{item.min_quantity > 0 ? ` (min: ${item.min_quantity} ${item.unit})` : ""}</span>
                        : <span>Stato bombola</span>
                      }
                      {item.notes && <span style={{ color: "#aaa", marginLeft: 8 }}>· {item.notes}</span>}
                    </div>
                    {item.updated_by && <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>Aggiornato da {item.updated_by}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {item.category === "Reagente" ? (
                      <>
                        <button onClick={() => { setSelected(item); setModal("load"); }} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #3B6D11", color: "#3B6D11", background: "transparent", cursor: "pointer" }}>
                          <i className="ti ti-arrow-up" style={{ fontSize: 13, verticalAlign: -2 }} /> Carica
                        </button>
                        <button onClick={() => { setSelected(item); setModal("unload"); }} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #854F0B", color: "#854F0B", background: "transparent", cursor: "pointer" }}>
                          <i className="ti ti-arrow-down" style={{ fontSize: 13, verticalAlign: -2 }} /> Scarica
                        </button>
                      </>
                    ) : (
                      <select value={item.status} onChange={e => updateStatus(item.id, e.target.value)}
                        style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
                        <option value="full">Piena</option>
                        <option value="partial">Parziale</option>
                        <option value="empty">Vuota</option>
                      </select>
                    )}
                    {currentUser.role === "admin" && (
                      <button onClick={() => deleteItem(item.id)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ccc", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
                        <i className="ti ti-trash" style={{ fontSize: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* MODAL AGGIUNGI */}
      {modal === "add" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 360, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Aggiungi elemento</p>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>×</button>
            </div>
            {[
              { label: "Nome", key: "name", type: "text", placeholder: "es. Etanolo 96%" },
              { label: "Quantità", key: "quantity", type: "number", placeholder: "0" },
              { label: "Unità", key: "unit", type: "text", placeholder: "es. L, kg, pz" },
              { label: "Scorta minima", key: "min_quantity", type: "number", placeholder: "0" },
              { label: "Note", key: "notes", type: "text", placeholder: "opzionale" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: "100%", marginBottom: 10, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
            ))}
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Categoria</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={{ width: "100%", marginBottom: 14, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              <option value="Reagente">Reagente</option>
              <option value="Bombola">Bombola</option>
            </select>
            <button onClick={addItem} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
              Aggiungi
            </button>
          </div>
        </div>
      )}

      {/* MODAL CARICA/SCARICA */}
      {(modal === "load" || modal === "unload") && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 320, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>{modal === "load" ? "📦 Carica" : "📤 Scarica"}: {selected.name}</p>
              <button onClick={() => { setModal(null); setAmount(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Quantità attuale: <b>{selected.quantity} {selected.unit}</b></p>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Quantità da {modal === "load" ? "aggiungere" : "rimuovere"}</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" placeholder="0"
              style={{ width: "100%", marginBottom: 14, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            <button onClick={() => updateQuantity(modal)} style={{
              width: "100%", padding: "9px", borderRadius: 8, border: "none",
              background: modal === "load" ? "#3B6D11" : "#854F0B", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer"
            }}>Conferma</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// App.js — LTCE con Supabase
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bmmoqcdtrehtcgxzbhth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbW9xY2R0cmVodGNneHpiaHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTUzNjMsImV4cCI6MjA5NjgzMTM2M30.ya0MRCMioCQmnJWCKEEF0njM3E1VJYgISqhGDIPfofc";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const SLOTS = ["08:00–10:00","10:00–12:00","12:00–14:00","14:00–16:00","16:00–18:00"];
const today = new Date();
const fmt = (d) => d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
const DAYS = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });

const STATUS_STYLE = {
  available: { bg: "#EAF3DE", color: "#3B6D11", label: "Disponibile" },
  maintenance: { bg: "#FAEEDA", color: "#854F0B", label: "Manutenzione" },
};

const CAT_COLORS = {
  "Cromatografia": "#7F77DD", "Ottica": "#178BCA", "Analisi elementare": "#1D9E75",
  "Biologia Molecolare": "#1D9E75", "Imaging": "#D4537E", "Pesatura": "#888780",
};

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
function InventoryPage({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("reagenti");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Reagente", quantity: "", unit: "", min_quantity: "", status: "available", notes: "" });
  const [amount, setAmount] = useState("");

  useEffect(() => {
    supabase.from("inventory").select("*").order("category").then(({ data }) => {
      setItems(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = items.filter(i => {
    const matchTab = tab === "reagenti" ? i.category === "Reagente" : i.category === "Bombola";
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.notes || "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const STATUS = {
    available: { bg: "#EAF3DE", color: "#3B6D11", label: "Disponibile" },
    low: { bg: "#FAEEDA", color: "#854F0B", label: "Scorta bassa" },
    exhausted: { bg: "#FAECE7", color: "#A32D2D", label: "Esaurito" },
    full: { bg: "#EAF3DE", color: "#3B6D11", label: "Piena" },
    partial: { bg: "#FAEEDA", color: "#854F0B", label: "Parziale" },
    empty: { bg: "#FAECE7", color: "#A32D2D", label: "Vuota" },
  };

  const getStatus = (item) => {
    if (item.category === "Bombola") return STATUS[item.status] || STATUS.available;
    if (item.quantity === 0) return STATUS.exhausted;
    if (item.min_quantity > 0 && item.quantity <= item.min_quantity) return STATUS.low;
    return STATUS.available;
  };

  const addItem = async () => {
    if (!form.name.trim()) return alert("Inserisci il nome!");
    const { data, error } = await supabase.from("inventory").insert([{
      ...form, quantity: +form.quantity, min_quantity: +form.min_quantity, updated_by: currentUser.name
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setItems(prev => [...prev, data]);
    setModal(null);
    setForm({ name: "", category: "Reagente", quantity: "", unit: "", min_quantity: "", status: "available", notes: "" });
  };

  const updateQuantity = async (type) => {
    const delta = type === "load" ? +amount : -amount;
    const newQty = Math.max(0, selected.quantity + delta);
    const newStatus = newQty === 0 ? "exhausted" : "available";
    const { data, error } = await supabase.from("inventory").update({
      quantity: newQty, status: newStatus, updated_by: currentUser.name, updated_at: new Date()
    }).eq("id", selected.id).select().single();
    if (error) return alert("Errore: " + error.message);
    setItems(prev => prev.map(i => i.id === selected.id ? data : i));
    setModal(null);
    setAmount("");
  };

  const updateStatus = async (id, status) => {
    const { data, error } = await supabase.from("inventory").update({
      status, updated_by: currentUser.name, updated_at: new Date()
    }).eq("id", id).select().single();
    if (error) return alert("Errore: " + error.message);
    setItems(prev => prev.map(i => i.id === id ? data : i));
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Vuoi eliminare questo elemento?")) return;
    await supabase.from("inventory").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Caricamento...</div>;

  return (
    <div>
      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("reagenti")} style={{
          flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "reagenti" ? "#1D9E75" : "#f0f0f0",
          color: tab === "reagenti" ? "#fff" : "#555",
          fontWeight: tab === "reagenti" ? 600 : 400, fontSize: 14
        }}>🧪 Reagenti</button>
        <button onClick={() => setTab("bombole")} style={{
          flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer",
          background: tab === "bombole" ? "#178BCA" : "#f0f0f0",
          color: tab === "bombole" ? "#fff" : "#555",
          fontWeight: tab === "bombole" ? 600 : 400, fontSize: 14
        }}>🫧 Bombole Gas</button>
      </div>

      {/* Search + Aggiungi */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cerca..."
          style={{ flex: 1, fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "0.5px solid #ccc" }} />
        <button onClick={() => setModal("add")} style={{
          fontSize: 12, padding: "7px 14px", borderRadius: 6, border: "none",
          background: "#7F77DD", color: "#fff", cursor: "pointer", whiteSpace: "nowrap"
        }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Aggiungi
        </button>
      </div>

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0
          ? <p style={{ fontSize: 13, color: "#aaa" }}>Nessun elemento trovato</p>
          : filtered.map(item => {
              const st = getStatus(item);
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.8rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {item.category === "Reagente"
                        ? <span>Quantità: <b>{item.quantity} {item.unit}</b>{item.min_quantity > 0 ? ` (min: ${item.min_quantity} ${item.unit})` : ""}</span>
                        : <span>Stato bombola</span>
                      }
                      {item.notes && <span style={{ color: "#aaa", marginLeft: 8 }}>· {item.notes}</span>}
                    </div>
                    {item.updated_by && <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>Aggiornato da {item.updated_by}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {item.category === "Reagente" ? (
                      <>
                        <button onClick={() => { setSelected(item); setModal("load"); }} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #3B6D11", color: "#3B6D11", background: "transparent", cursor: "pointer" }}>
                          <i className="ti ti-arrow-up" style={{ fontSize: 13, verticalAlign: -2 }} /> Carica
                        </button>
                        <button onClick={() => { setSelected(item); setModal("unload"); }} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #854F0B", color: "#854F0B", background: "transparent", cursor: "pointer" }}>
                          <i className="ti ti-arrow-down" style={{ fontSize: 13, verticalAlign: -2 }} /> Scarica
                        </button>
                      </>
                    ) : (
                      <select value={item.status} onChange={e => updateStatus(item.id, e.target.value)}
                        style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
                        <option value="full">Piena</option>
                        <option value="partial">Parziale</option>
                        <option value="empty">Vuota</option>
                      </select>
                    )}
                    {currentUser.role === "admin" && (
                      <button onClick={() => deleteItem(item.id)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid #ccc", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
                        <i className="ti ti-trash" style={{ fontSize: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* MODAL AGGIUNGI */}
      {modal === "add" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 360, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Aggiungi elemento</p>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>×</button>
            </div>
            {[
              { label: "Nome", key: "name", type: "text", placeholder: "es. Etanolo 96%" },
              { label: "Quantità", key: "quantity", type: "number", placeholder: "0" },
              { label: "Unità", key: "unit", type: "text", placeholder: "es. L, kg, pz" },
              { label: "Scorta minima", key: "min_quantity", type: "number", placeholder: "0" },
              { label: "Note", key: "notes", type: "text", placeholder: "opzionale" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: "100%", marginBottom: 10, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
            ))}
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Categoria</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              style={{ width: "100%", marginBottom: 14, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              <option value="Reagente">Reagente</option>
              <option value="Bombola">Bombola</option>
            </select>
            <button onClick={addItem} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
              Aggiungi
            </button>
          </div>
        </div>
      )}

      {/* MODAL CARICA/SCARICA */}
      {(modal === "load" || modal === "unload") && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 320, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>{modal === "load" ? "📦 Carica" : "📤 Scarica"}: {selected.name}</p>
              <button onClick={() => { setModal(null); setAmount(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Quantità attuale: <b>{selected.quantity} {selected.unit}</b></p>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Quantità da {modal === "load" ? "aggiungere" : "rimuovere"}</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" placeholder="0"
              style={{ width: "100%", marginBottom: 14, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            <button onClick={() => updateQuantity(modal)} style={{
              width: "100%", padding: "9px", borderRadius: 8, border: "none",
              background: modal === "load" ? "#3B6D11" : "#854F0B", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer"
            }}>Conferma</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Email o password errati."); setLoading(false); return; }
    const { data: userData } = await supabase.from("users").select("*").eq("email", email).single();
    if (!userData) { setError("Utente non trovato. Contatta l'admin."); setLoading(false); return; }
    if (userData.status === "pending") { setError("Il tuo account è in attesa di approvazione dall'admin."); setLoading(false); return; }
    onLogin(userData);
    setLoading(false);
  };

  const register = async () => {
    if (!name.trim()) { setError("Inserisci il tuo nome."); return; }
    if (!email.trim()) { setError("Inserisci la tua email."); return; }
    if (password.length < 6) { setError("La password deve essere di almeno 6 caratteri."); return; }
    setLoading(true);
    setError("");

    // Crea utente in Supabase Auth
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }

    // Inserisci utente nella tabella users con status "pending"
    const { error: dbError } = await supabase.from("users").insert([{
      name: name.trim(), email: email.trim(), role: "researcher", status: "pending"
    }]);
    if (dbError) { setError("Errore: " + dbError.message); setLoading(false); return; }

    // Invia email all'admin
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "registration_request", userName: name, userEmail: email })
    });

    setSuccess("Richiesta inviata! L'admin riceverà una notifica e approverà il tuo accesso.");
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f7" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", width: 340, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <i className="ti ti-flask" style={{ fontSize: 36, color: "#7F77DD" }} />
          <h2 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 600 }}>LTCE</h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{mode === "login" ? "Accedi" : "Richiedi accesso"}</p>
        </div>

        {/* Tab login/registrati */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f5f5f5", borderRadius: 8, padding: 4 }}>
          <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{
            flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer",
            background: mode === "login" ? "#fff" : "transparent",
            color: mode === "login" ? "#333" : "#888", fontWeight: mode === "login" ? 500 : 400, fontSize: 13,
            boxShadow: mode === "login" ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
          }}>Accedi</button>
          <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }} style={{
            flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer",
            background: mode === "register" ? "#fff" : "transparent",
            color: mode === "register" ? "#333" : "#888", fontWeight: mode === "register" ? 500 : 400, fontSize: 13,
            boxShadow: mode === "register" ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
          }}>Registrati</button>
        </div>

        {error && <p style={{ color: "#A32D2D", fontSize: 13, background: "#FAECE7", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: "#3B6D11", fontSize: 13, background: "#EAF3DE", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{success}</p>}

        {mode === "register" && (
          <>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Nome e Cognome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="es. Mario Rossi"
              style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
          </>
        )}

        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@lab.it" type="email"
          style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ccc", boxSizing: "border-box" }} />

        <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password"
          onKeyDown={e => e.key === "Enter" && (mode === "login" ? login() : register())}
          style={{ width: "100%", marginBottom: 16, fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "0.5px solid #ccc", boxSizing: "border-box" }} />

        <button onClick={mode === "login" ? login : register} disabled={loading}
          style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
          {loading ? "Attendere..." : mode === "login" ? "Accedi" : "Richiedi accesso"}
        </button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("catalog");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ day: 0, slot: 0, note: "" });
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "researcher" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoading(true);
      const [{ data: u }, { data: e }, { data: b }] = await Promise.all([
        supabase.from("users").select("*").order("id"),
        supabase.from("equipment").select("*").order("id"),
        supabase.from("bookings").select("*").order("id"),
      ]);
      setUsers(u || []);
      setEquipment(e || []);
      setBookings(b || []);
      setLoading(false);
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") return;
    supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setLogs(data || []));
  }, [currentUser]);

  const addLog = async (action, equipName, details) => {
    const entry = { action, user_name: currentUser.name, equipment_name: equipName || null, details: details || null };
    const { data } = await supabase.from("logs").insert([entry]).select().single();
    if (data) setLogs(prev => [data, ...prev]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]); setEquipment([]); setBookings([]);
  };

  const sendEmail = async (type, details) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          userName: currentUser.name,
          userEmail: currentUser.email,
          bookingDetails: details || ""
        })
      });
    } catch (err) {
      console.error("Errore invio email:", err);
    }
  };

  const isBooked = (equipId, day, slot) =>
    bookings.find(b => b.equip_id === equipId && b.day === day && b.slot === slot);

  const book = async () => {
    if (isBooked(modal.id, form.day, form.slot)) return alert("Slot già occupato!");
    const { data, error } = await supabase.from("bookings").insert([{
      equip_id: modal.id, user_id: currentUser.id, day: form.day, slot: form.slot, note: form.note
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setBookings(prev => [...prev, data]);
    await addLog("Prenotazione creata", modal.name, `${fmt(DAYS[form.day])} · ${SLOTS[form.slot]}`);
    await sendEmail("booking_created", `${modal.name} — ${fmt(DAYS[form.day])} · ${SLOTS[form.slot]}`);
    setModal(null);
  };

  const cancel = async (bookingId) => {
    const b = bookings.find(x => x.id === bookingId);
    if (b.user_id !== currentUser.id && currentUser.role !== "admin") return alert("Non puoi annullare prenotazioni altrui!");
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) return alert("Errore: " + error.message);
    const eq = equipment.find(e => e.id === b.equip_id);
    await addLog("Prenotazione annullata", eq?.name, `${fmt(DAYS[b.day])} · ${SLOTS[b.slot]}`);
    await sendEmail("booking_cancelled", `${eq?.name} — ${fmt(DAYS[b.day])} · ${SLOTS[b.slot]}`);
    setBookings(prev => prev.filter(x => x.id !== bookingId));
  };

  const addUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return alert("Inserisci nome ed email!");
    const { data, error } = await supabase.from("users").insert([{
      name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => [...prev, data]);
    setUserForm({ name: "", email: "", role: "researcher" });
  };

  const removeUser = async (userId) => {
    if (userId === currentUser.id) return alert("Non puoi rimuovere te stesso!");
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setBookings(prev => prev.filter(b => b.user_id !== userId));
  };

  const changeRole = async (userId, role) => {
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  const myBookings = bookings.filter(b => b.user_id === currentUser.id);

  const navBtn = (v, label, icon) => (
    <button onClick={() => setView(v)} style={{
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      background: view === v ? "#7F77DD" : "transparent",
      color: view === v ? "#fff" : "#666",
      fontWeight: view === v ? 500 : 400, fontSize: 14, display: "flex", alignItems: "center", gap: 6
    }}>
      <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize: 16 }} />{label}
    </button>
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#666" }}>
      <i className="ti ti-loader-2" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
      Caricamento...
    </div>
  );

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: "1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "0.5px solid #e0e0e0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-flask" style={{ fontSize: 22, color: "#7F77DD" }} />
          <span style={{ fontWeight: 500, fontSize: 17 }}>LTCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#888" }}>👤 {currentUser.name}</span>
          <button onClick={logout} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent", color: "#888", cursor: "pointer" }}>
            <i className="ti ti-logout" style={{ fontSize: 13, verticalAlign: -2, marginRight: 4 }} />Esci
          </button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {navBtn("catalog", "Apparecchiature", "microscope")}
        {navBtn("calendar", "Calendario", "calendar")}
        {navBtn("mybookings", "Le mie prenotazioni", "bookmark")}
        {navBtn("inventory", "Inventario", "box")}
        {currentUser.role === "admin" && navBtn("admin", "Admin", "settings")}
      </div>

      {/* CATALOG */}
      {view === "catalog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {equipment.map(eq => {
            const busy = bookings.filter(b => b.equip_id === eq.id).length;
            const st = STATUS_STYLE[eq.status] || STATUS_STYLE.available;
            const catColor = CAT_COLORS[eq.category] || "#888";
            return (
              <div key={eq.id} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: catColor + "22", color: catColor }}>{eq.category}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <p style={{ fontWeight: 500, fontSize: 14, margin: "6px 0 4px" }}>{eq.name}</p>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px" }}>{eq.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{busy} prenotazioni</span>
                  {eq.status !== "maintenance" && (
                    <button onClick={() => { setModal(eq); setForm({ day: 0, slot: 0, note: "" }); }}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid #7F77DD", background: "transparent", color: "#7F77DD", cursor: "pointer" }}>
                      <i className="ti ti-calendar-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Prenota
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR */}
      {view === "calendar" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Prossimi 7 giorni</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 8px", textAlign: "left", color: "#888", fontWeight: 500, borderBottom: "0.5px solid #e0e0e0" }}>Slot</th>
                {DAYS.map((d, i) => (
                  <th key={i} style={{ padding: "6px 8px", textAlign: "center", color: "#888", fontWeight: 500, borderBottom: "0.5px solid #e0e0e0", minWidth: 80 }}>{fmt(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, si) => (
                <tr key={si}>
                  <td style={{ padding: "6px 8px", color: "#888", whiteSpace: "nowrap", borderBottom: "0.5px solid #e0e0e0" }}>{slot}</td>
                  {DAYS.map((_, di) => {
                    const dayBookings = bookings.filter(b => b.day === di && b.slot === si);
                    return (
                      <td key={di} style={{ padding: 4, textAlign: "center", borderBottom: "0.5px solid #e0e0e0" }}>
                        {dayBookings.length === 0
                          ? <span style={{ fontSize: 11, color: "#3B6D11", background: "#EAF3DE", padding: "2px 6px", borderRadius: 4 }}>libero</span>
                          : dayBookings.map(b => {
                              const eq = equipment.find(e => e.id === b.equip_id);
                              const usr = users.find(u => u.id === b.user_id);
                              return <div key={b.id} style={{ fontSize: 10, background: "#EEEDFE", color: "#534AB7", borderRadius: 4, padding: "2px 4px", marginBottom: 2 }}>{eq?.name.split(" ")[0]}<br /><span style={{ color: "#7F77DD" }}>{usr?.name.split(" ")[0]}</span></div>;
                            })
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MY BOOKINGS */}
      {view === "mybookings" && (
        <div>
          {myBookings.length === 0
            ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                <i className="ti ti-calendar-off" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                Nessuna prenotazione attiva
              </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myBookings.map(b => {
                  const eq = equipment.find(e => e.id === b.equip_id);
                  return (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10, padding: "0.8rem 1rem" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="ti ti-flask" style={{ fontSize: 20, color: "#7F77DD" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{eq?.name}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                          {fmt(DAYS[b.day])} · {SLOTS[b.slot]}
                          {b.note && <span style={{ color: "#aaa" }}> · {b.note}</span>}
                        </p>
                      </div>
                      <button onClick={() => cancel(b.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
                        <i className="ti ti-trash" style={{ fontSize: 14, verticalAlign: -2 }} /> Annulla
                      </button>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* INVENTORY */}
      {view === "inventory" && <InventoryPage currentUser={currentUser} />}

      {/* ADMIN */}
      {view === "admin" && currentUser.role === "admin" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Prenotazioni totali", value: bookings.length, icon: "calendar" },
              { label: "Apparecchiature", value: equipment.length, icon: "microscope" },
              { label: "Utenti registrati", value: users.length, icon: "users" },
            ].map((m, i) => (
              <div key={i} style={{ background: "#f5f5f5", borderRadius: 8, padding: "0.8rem 1rem" }}>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}><i className={`ti ti-${m.icon}`} style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />{m.label}</p>
                <p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "20px 0 8px" }}>Gestione utenti</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome e cognome"
              style={{ flex: 1, minWidth: 120, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }} />
            <input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@lab.it"
              style={{ flex: 1, minWidth: 120, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }} />
            <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
              style={{ fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              <option value="researcher">Ricercatore</option>
              <option value="technician">Tecnico</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={addUser} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#7F77DD", color: "#fff", fontSize: 13, cursor: "pointer" }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2 }} /> Aggiungi
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {users.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#534AB7" }}>
                  {u.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{u.email}</p>
                </div>
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                  style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "0.5px solid #ccc" }}>
                  <option value="researcher">Ricercatore</option>
                  <option value="technician">Tecnico</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => removeUser(u.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
                  <i className="ti ti-trash" style={{ fontSize: 13 }} />
                </button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "20px 0 8px" }}>📋 Cronologia azioni</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {logs.length === 0
              ? <p style={{ fontSize: 13, color: "#aaa" }}>Nessuna azione registrata</p>
              : logs.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                  <i className={`ti ti-${l.action.includes("creata") ? "calendar-plus" : "calendar-minus"}`}
                    style={{ fontSize: 16, color: l.action.includes("creata") ? "#3B6D11" : "#A32D2D" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{l.action}</span>
                    {l.equipment_name && <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>— {l.equipment_name}</span>}
                    {l.details && <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>{l.details}</span>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{l.user_name}</p>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{new Date(l.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))
            }
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", marginBottom: 8 }}>Tutte le prenotazioni</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bookings.map(b => {
              const eq = equipment.find(e => e.id === b.equip_id);
              const usr = users.find(u => u.id === b.user_id);
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{eq?.name}</span>
                    <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{fmt(DAYS[b.day])} · {SLOTS[b.slot]}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#888" }}>{usr?.name}</span>
                  <button onClick={() => cancel(b.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
                    <i className="ti ti-x" style={{ fontSize: 13 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL PRENOTAZIONE */}
      {modal && modal.id && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 340, maxWidth: "90vw", border: "0.5px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Prenota: {modal.name}</p>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}><i className="ti ti-x" /></button>
            </div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Giorno</label>
            <select value={form.day} onChange={e => setForm(f => ({ ...f, day: +e.target.value }))}
              style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              {DAYS.map((d, i) => <option key={i} value={i}>{fmt(d)}</option>)}
            </select>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Fascia oraria</label>
            <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: +e.target.value }))}
              style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              {SLOTS.map((s, i) => {
                const taken = isBooked(modal.id, form.day, i);
                return <option key={i} value={i}>{s}{taken ? " — occupato" : ""}</option>;
              })}
            </select>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Note (opzionale)</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="es. campioni da analizzare..."
              style={{ width: "100%", marginBottom: 16, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            <button onClick={book} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
              <i className="ti ti-check" style={{ marginRight: 6 }} />Conferma prenotazione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("catalog");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ day: 0, slot: 0, note: "" });
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "researcher" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoading(true);
      const [{ data: u }, { data: e }, { data: b }] = await Promise.all([
        supabase.from("users").select("*").order("id"),
        supabase.from("equipment").select("*").order("id"),
        supabase.from("bookings").select("*").order("id"),
      ]);
      setUsers(u || []);
      setEquipment(e || []);
      setBookings(b || []);
      setLoading(false);
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") return;
    supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setLogs(data || []));
  }, [currentUser]);

  const addLog = async (action, equipName, details) => {
    const entry = { action, user_name: currentUser.name, equipment_name: equipName || null, details: details || null };
    const { data } = await supabase.from("logs").insert([entry]).select().single();
    if (data) setLogs(prev => [data, ...prev]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]); setEquipment([]); setBookings([]);
  };
const sendEmail = async (type, details) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          userName: currentUser.name,
          userEmail: currentUser.email,
          bookingDetails: details || ""
        })
      });
    } catch (err) {
      console.error("Errore invio email:", err);
    }
  };
  const isBooked = (equipId, day, slot) =>
    bookings.find(b => b.equip_id === equipId && b.day === day && b.slot === slot);

  const book = async () => {
    if (isBooked(modal.id, form.day, form.slot)) return alert("Slot già occupato!");
    const { data, error } = await supabase.from("bookings").insert([{
      equip_id: modal.id, user_id: currentUser.id, day: form.day, slot: form.slot, note: form.note
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setBookings(prev => [...prev, data]);
    await addLog("Prenotazione creata", modal.name, `${fmt(DAYS[form.day])} · ${SLOTS[form.slot]}`);
    await sendEmail("booking_created", `${modal.name} — ${fmt(DAYS[form.day])} · ${SLOTS[form.slot]}`);
    setModal(null);
  };

  const cancel = async (bookingId) => {
    const b = bookings.find(x => x.id === bookingId);
    if (b.user_id !== currentUser.id && currentUser.role !== "admin") return alert("Non puoi annullare prenotazioni altrui!");
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) return alert("Errore: " + error.message);
    const eq = equipment.find(e => e.id === b.equip_id);
    await addLog("Prenotazione annullata", eq?.name, `${fmt(DAYS[b.day])} · ${SLOTS[b.slot]}`);
    await sendEmail("booking_cancelled", `${eq?.name} — ${fmt(DAYS[b.day])} · ${SLOTS[b.slot]}`);
    setBookings(prev => prev.filter(x => x.id !== bookingId));
  };

  const addUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return alert("Inserisci nome ed email!");
    const { data, error } = await supabase.from("users").insert([{
      name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => [...prev, data]);
    setUserForm({ name: "", email: "", role: "researcher" });
  };

  const removeUser = async (userId) => {
    if (userId === currentUser.id) return alert("Non puoi rimuovere te stesso!");
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setBookings(prev => prev.filter(b => b.user_id !== userId));
  };

  const changeRole = async (userId, role) => {
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  const myBookings = bookings.filter(b => b.user_id === currentUser.id);

  const navBtn = (v, label, icon) => (
    <button onClick={() => setView(v)} style={{
      padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      background: view === v ? "#7F77DD" : "transparent",
      color: view === v ? "#fff" : "#666",
      fontWeight: view === v ? 500 : 400, fontSize: 14, display: "flex", alignItems: "center", gap: 6
    }}>
      <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize: 16 }} />{label}
    </button>
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#666" }}>
      <i className="ti ti-loader-2" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
      Caricamento...
    </div>
  );

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: "1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "0.5px solid #e0e0e0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-flask" style={{ fontSize: 22, color: "#7F77DD" }} />
          <span style={{ fontWeight: 500, fontSize: 17 }}>LTCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#888" }}>👤 {currentUser.name}</span>
          <button onClick={logout} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent", color: "#888", cursor: "pointer" }}>
            <i className="ti ti-logout" style={{ fontSize: 13, verticalAlign: -2, marginRight: 4 }} />Esci
          </button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {navBtn("catalog", "Apparecchiature", "microscope")}
        {navBtn("calendar", "Calendario", "calendar")}
        {navBtn("mybookings", "Le mie prenotazioni", "bookmark")}
        {navBtn("inventory", "Inventario", "box")}
        {currentUser.role === "admin" && navBtn("admin", "Admin", "settings")}
      </div>

      {/* CATALOG */}
      {view === "catalog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {equipment.map(eq => {
            const busy = bookings.filter(b => b.equip_id === eq.id).length;
            const st = STATUS_STYLE[eq.status] || STATUS_STYLE.available;
            const catColor = CAT_COLORS[eq.category] || "#888";
            return (
              <div key={eq.id} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: catColor + "22", color: catColor }}>{eq.category}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <p style={{ fontWeight: 500, fontSize: 14, margin: "6px 0 4px" }}>{eq.name}</p>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px" }}>{eq.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{busy} prenotazioni</span>
                  {eq.status !== "maintenance" && (
                    <button onClick={() => { setModal(eq); setForm({ day: 0, slot: 0, note: "" }); }}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid #7F77DD", background: "transparent", color: "#7F77DD", cursor: "pointer" }}>
                      <i className="ti ti-calendar-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Prenota
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR */}
      {view === "calendar" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Prossimi 7 giorni</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 8px", textAlign: "left", color: "#888", fontWeight: 500, borderBottom: "0.5px solid #e0e0e0" }}>Slot</th>
                {DAYS.map((d, i) => (
                  <th key={i} style={{ padding: "6px 8px", textAlign: "center", color: "#888", fontWeight: 500, borderBottom: "0.5px solid #e0e0e0", minWidth: 80 }}>{fmt(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, si) => (
                <tr key={si}>
                  <td style={{ padding: "6px 8px", color: "#888", whiteSpace: "nowrap", borderBottom: "0.5px solid #e0e0e0" }}>{slot}</td>
                  {DAYS.map((_, di) => {
                    const dayBookings = bookings.filter(b => b.day === di && b.slot === si);
                    return (
                      <td key={di} style={{ padding: 4, textAlign: "center", borderBottom: "0.5px solid #e0e0e0" }}>
                        {dayBookings.length === 0
                          ? <span style={{ fontSize: 11, color: "#3B6D11", background: "#EAF3DE", padding: "2px 6px", borderRadius: 4 }}>libero</span>
                          : dayBookings.map(b => {
                              const eq = equipment.find(e => e.id === b.equip_id);
                              const usr = users.find(u => u.id === b.user_id);
                              return <div key={b.id} style={{ fontSize: 10, background: "#EEEDFE", color: "#534AB7", borderRadius: 4, padding: "2px 4px", marginBottom: 2 }}>{eq?.name.split(" ")[0]}<br /><span style={{ color: "#7F77DD" }}>{usr?.name.split(" ")[0]}</span></div>;
                            })
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MY BOOKINGS */}
      {view === "mybookings" && (
        <div>
          {myBookings.length === 0
            ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                <i className="ti ti-calendar-off" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                Nessuna prenotazione attiva
              </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myBookings.map(b => {
                  const eq = equipment.find(e => e.id === b.equip_id);
                  return (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10, padding: "0.8rem 1rem" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="ti ti-flask" style={{ fontSize: 20, color: "#7F77DD" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{eq?.name}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                          {fmt(DAYS[b.day])} · {SLOTS[b.slot]}
                          {b.note && <span style={{ color: "#aaa" }}> · {b.note}</span>}
                        </p>
                      </div>
                      <button onClick={() => cancel(b.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
                        <i className="ti ti-trash" style={{ fontSize: 14, verticalAlign: -2 }} /> Annulla
                      </button>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* INVENTORY */}
      {view === "inventory" && <InventoryPage currentUser={currentUser} />}

      {/* ADMIN */}
      {view === "admin" && currentUser.role === "admin" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Prenotazioni totali", value: bookings.length, icon: "calendar" },
              { label: "Apparecchiature", value: equipment.length, icon: "microscope" },
              { label: "Utenti registrati", value: users.length, icon: "users" },
            ].map((m, i) => (
              <div key={i} style={{ background: "#f5f5f5", borderRadius: 8, padding: "0.8rem 1rem" }}>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}><i className={`ti ti-${m.icon}`} style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />{m.label}</p>
                <p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "20px 0 8px" }}>Gestione utenti</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome e cognome"
              style={{ flex: 1, minWidth: 120, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }} />
            <input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@lab.it"
              style={{ flex: 1, minWidth: 120, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }} />
            <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
              style={{ fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              <option value="researcher">Ricercatore</option>
              <option value="technician">Tecnico</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={addUser} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#7F77DD", color: "#fff", fontSize: 13, cursor: "pointer" }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2 }} /> Aggiungi
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {users.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#534AB7" }}>
                  {u.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{u.email}</p>
                </div>
                <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                  style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "0.5px solid #ccc" }}>
                  <option value="researcher">Ricercatore</option>
                  <option value="technician">Tecnico</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => removeUser(u.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
                  <i className="ti ti-trash" style={{ fontSize: 13 }} />
                </button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "20px 0 8px" }}>📋 Cronologia azioni</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {logs.length === 0
              ? <p style={{ fontSize: 13, color: "#aaa" }}>Nessuna azione registrata</p>
              : logs.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                  <i className={`ti ti-${l.action.includes("creata") ? "calendar-plus" : "calendar-minus"}`}
                    style={{ fontSize: 16, color: l.action.includes("creata") ? "#3B6D11" : "#A32D2D" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{l.action}</span>
                    {l.equipment_name && <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>— {l.equipment_name}</span>}
                    {l.details && <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>{l.details}</span>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{l.user_name}</p>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{new Date(l.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))
            }
          </div>

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", marginBottom: 8 }}>Tutte le prenotazioni</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bookings.map(b => {
              const eq = equipment.find(e => e.id === b.equip_id);
              const usr = users.find(u => u.id === b.user_id);
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{eq?.name}</span>
                    <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{fmt(DAYS[b.day])} · {SLOTS[b.slot]}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#888" }}>{usr?.name}</span>
                  <button onClick={() => cancel(b.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
                    <i className="ti ti-x" style={{ fontSize: 13 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL PRENOTAZIONE */}
      {modal && modal.id && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 340, maxWidth: "90vw", border: "0.5px solid #ddd" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Prenota: {modal.name}</p>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}><i className="ti ti-x" /></button>
            </div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Giorno</label>
            <select value={form.day} onChange={e => setForm(f => ({ ...f, day: +e.target.value }))}
              style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              {DAYS.map((d, i) => <option key={i} value={i}>{fmt(d)}</option>)}
            </select>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Fascia oraria</label>
            <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: +e.target.value }))}
              style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }}>
              {SLOTS.map((s, i) => {
                const taken = isBooked(modal.id, form.day, i);
                return <option key={i} value={i}>{s}{taken ? " — occupato" : ""}</option>;
              })}
            </select>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Note (opzionale)</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="es. campioni da analizzare..."
              style={{ width: "100%", marginBottom: 16, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            <button onClick={book} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
              <i className="ti ti-check" style={{ marginRight: 6 }} />Conferma prenotazione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}