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

const RESEND_KEY = "re_XvCrYkRE_EgRn41UewFhM5K53m6YmuTPB";
const ADMIN_EMAIL = "claudia.prestigiacomo01@unipa.it";

const sendEmailDirect = async (subject, html) => {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: "onboarding@resend.dev", to: ADMIN_EMAIL, subject, html })
    });
  } catch (err) { console.error("Email error:", err); }
};

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
function InventoryPage({ currentUser }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("reagenti");
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Reagente", quantity: "", unit: "", min_quantity: "", status: "available", location: "", notes: "" });
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
    const matchLocation = !filterLocation || (i.location || "") === filterLocation || (i.notes || "").toLowerCase().includes(filterLocation.toLowerCase());
    const matchStatus = !filterStatus || i.status === filterStatus;
    return matchTab && matchSearch && matchLocation && matchStatus;
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
    setForm({ name: "", category: "Reagente", quantity: "", unit: "", min_quantity: "", status: "available", location: "", notes: "" });
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

  const updateLocation = async (id, location) => {
    const { data, error } = await supabase.from("inventory").update({
      location, updated_by: currentUser.name, updated_at: new Date()
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setTab("reagenti"); setFilterLocation(""); setFilterStatus(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "reagenti" ? "#1D9E75" : "#f0f0f0", color: tab === "reagenti" ? "#fff" : "#555", fontWeight: tab === "reagenti" ? 600 : 400, fontSize: 14 }}>🧪 Reagenti</button>
        <button onClick={() => { setTab("bombole"); setFilterLocation(""); setFilterStatus(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "bombole" ? "#178BCA" : "#f0f0f0", color: tab === "bombole" ? "#fff" : "#555", fontWeight: tab === "bombole" ? 600 : 400, fontSize: 14 }}>🫧 Bombole Gas</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cerca..."
          style={{ flex: "1 1 140px", fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "0.5px solid #ccc", minWidth: 120 }} />
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
          style={{ flex: "1 1 120px", fontSize: 12, padding: "7px 8px", borderRadius: 8, border: "0.5px solid #ccc", minWidth: 100 }}>
          <option value="">📍 Posizione</option>
          {tab === "reagenti" ? (
            <>
              <option value="piano terra">Piano Terra</option>
              <option value="armadio">Armadio</option>
              <option value="scaffale">Scaffale</option>
              <option value="frigo">Frigorifero</option>
              <option value="cappa">Cappa</option>
              <option value="armadietto">Armadietto</option>
            </>
          ) : (
            <>
              <option value="gabbiotto_inerti">Gabbiotto Inerti</option>
              <option value="gabbiotto_infiammabili">Gabbiotto Infiammabili</option>
              <option value="laboratorio">Laboratorio</option>
              <option value="cappa">Cappa</option>
              <option value="esterno">Esterno</option>
            </>
          )}
        </select>
        {tab === "bombole" && (
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ flex: "1 1 100px", fontSize: 12, padding: "7px 8px", borderRadius: 8, border: "0.5px solid #ccc", minWidth: 90 }}>
            <option value="">🔵 Stato</option>
            <option value="full">Piena</option>
            <option value="partial">Parziale</option>
            <option value="empty">Vuota</option>
          </select>
        )}
        <button onClick={() => setModal("add")} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 6, border: "none", background: "#7F77DD", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
          <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Aggiungi
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0
          ? <p style={{ fontSize: 13, color: "#aaa" }}>Nessun elemento trovato</p>
          : filtered.map(item => {
              const st = getStatus(item);
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.8rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {item.category === "Reagente"
                        ? <span>Qta: <b>{item.quantity} {item.unit}</b>{item.min_quantity > 0 ? ` (min: ${item.min_quantity})` : ""}</span>
                        : <span>Bombola</span>}
                      {item.location && <span style={{ color: "#7F77DD", marginLeft: 6 }}>· 📍 {item.location}</span>}
                      {item.notes && <span style={{ color: "#aaa", marginLeft: 6 }}>· {item.notes}</span>}
                    </div>
                    {item.updated_by && <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>Aggiornato da {item.updated_by}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {item.category === "Reagente" ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setSelected(item); setModal("load"); }} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #3B6D11", color: "#3B6D11", background: "transparent", cursor: "pointer" }}>↑ Carica</button>
                        <button onClick={() => { setSelected(item); setModal("unload"); }} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #854F0B", color: "#854F0B", background: "transparent", cursor: "pointer" }}>↓ Scarica</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <select value={item.status} onChange={e => updateStatus(item.id, e.target.value)}
                          style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "0.5px solid #ccc" }}>
                          <option value="full">Piena</option>
                          <option value="partial">Parziale</option>
                          <option value="empty">Vuota</option>
                        </select>
                        <select value={item.location || ""} onChange={e => updateLocation(item.id, e.target.value)}
                          style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "0.5px solid #ccc" }}>
                          <option value="">📍 Posizione</option>
                          <option value="gabbiotto_inerti">Gabbiotto Inerti</option>
                          <option value="gabbiotto_infiammabili">Gabbiotto Infiammabili</option>
                          <option value="laboratorio">Laboratorio</option>
                          <option value="cappa">Cappa</option>
                          <option value="esterno">Esterno</option>
                        </select>
                      </div>
                    )}
                    {currentUser.role === "admin" && (
                      <button onClick={() => deleteItem(item.id)} style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "0.5px solid #ccc", color: "#A32D2D", background: "transparent", cursor: "pointer" }}>
                        <i className="ti ti-trash" style={{ fontSize: 12 }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
        }
      </div>

      {modal === "add" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 360, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Aggiungi elemento</p>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>×</button>
            </div>
            {[
              { label: "Nome", key: "name", type: "text", placeholder: "es. Etanolo 96%" },
              { label: "Quantità", key: "quantity", type: "number", placeholder: "0" },
              { label: "Unità", key: "unit", type: "text", placeholder: "es. L, kg, pz" },
              { label: "Scorta minima", key: "min_quantity", type: "number", placeholder: "0" },
              { label: "Posizione", key: "location", type: "text", placeholder: "es. Armadio 1A, Piano Terra..." },
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
            <button onClick={addItem} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Aggiungi</button>
          </div>
        </div>
      )}

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
            <button onClick={() => updateQuantity(modal)} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: modal === "load" ? "#3B6D11" : "#854F0B", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>Conferma</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRESENZE ─────────────────────────────────────────────────────────────────
function PresenzeePage({ currentUser }) {
  const [presenze, setPresenze] = useState([]);
  const [postazioni, setPostazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ data: "", ora_inizio: "", ora_fine: "", attivita: "" });
  const [filterDate, setFilterDate] = useState("");
  const [occupyModal, setOccupyModal] = useState(null);
  const [occupyForm, setOccupyForm] = useState({ attivita: "", ora_inizio: "", ora_fine: "" });

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      supabase.from("presenze").select("*").order("data", { ascending: false }),
      supabase.from("postazioni").select("*").order("id")
    ]).then(([{ data: p }, { data: po }]) => {
      setPresenze(p || []);
      setPostazioni(po || []);
      setLoading(false);
    });
  }, []);

  const addPresenza = async () => {
    if (!form.data || !form.ora_inizio || !form.ora_fine) return alert("Compila data, ora inizio e ora fine!");
    if (form.ora_fine <= form.ora_inizio) return alert("L'ora di fine deve essere dopo l'ora di inizio!");
    const { data, error } = await supabase.from("presenze").insert([{
      user_id: currentUser.id, user_name: currentUser.name,
      data: form.data, ora_inizio: form.ora_inizio, ora_fine: form.ora_fine, attivita: form.attivita
    }]).select().single();
    if (error) return alert("Errore: " + error.message);
    setPresenze(prev => [data, ...prev]);
    setForm({ data: "", ora_inizio: "", ora_fine: "", attivita: "" });
    setShowForm(false);
  };

  const deletePresenza = async (id, userId) => {
    if (userId !== currentUser.id && currentUser.role !== "admin") return alert("Non puoi eliminare presenze altrui!");
    const { error } = await supabase.from("presenze").delete().eq("id", id);
    if (error) return alert("Errore: " + error.message);
    setPresenze(prev => prev.filter(p => p.id !== id));
  };

  const occupyPostazione = async () => {
    if (!occupyForm.ora_inizio || !occupyForm.ora_fine) return alert("Inserisci ora inizio e ora fine!");
    const { data, error } = await supabase.from("postazioni").update({
      occupied_by: currentUser.id,
      occupied_by_name: currentUser.name,
      attivita: occupyForm.attivita,
      ora_inizio: occupyForm.ora_inizio,
      ora_fine: occupyForm.ora_fine,
      data: todayStr
    }).eq("id", occupyModal.id).select().single();
    if (error) return alert("Errore: " + error.message);
    setPostazioni(prev => prev.map(p => p.id === occupyModal.id ? data : p));
    setOccupyModal(null);
    setOccupyForm({ attivita: "", ora_inizio: "", ora_fine: "" });
  };

  const freePostazione = async (id) => {
    const p = postazioni.find(x => x.id === id);
    if (p.occupied_by !== currentUser.id && currentUser.role !== "admin") return alert("Non puoi liberare postazioni altrui!");
    const { data, error } = await supabase.from("postazioni").update({
      occupied_by: null, occupied_by_name: null, attivita: null, ora_inizio: null, ora_fine: null, data: null
    }).eq("id", id).select().single();
    if (error) return alert("Errore: " + error.message);
    setPostazioni(prev => prev.map(p => p.id === id ? data : p));
  };

  const filtered = presenze.filter(p => !filterDate || p.data === filterDate);
  const grouped = filtered.reduce((acc, p) => {
    if (!acc[p.data]) acc[p.data] = [];
    acc[p.data].push(p);
    return acc;
  }, {});

  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  if (loading) return <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Caricamento...</div>;

  return (
    <div>
      {/* MAPPA POSTAZIONI */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 10 }}>🗺️ Postazioni laboratorio — oggi</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {postazioni.map(p => {
            const isOccupied = p.occupied_by !== null && p.data === todayStr;
            const isMine = p.occupied_by === currentUser.id && p.data === todayStr;
            return (
              <div key={p.id} style={{
                background: isOccupied ? (isMine ? "#EEEDFE" : "#FAECE7") : "#EAF3DE",
                border: `1.5px solid ${isOccupied ? (isMine ? "#7F77DD" : "#A32D2D") : "#3B6D11"}`,
                borderRadius: 10, padding: "0.7rem 0.8rem", cursor: isOccupied && !isMine ? "default" : "pointer",
                transition: "transform 0.1s"
              }}
                onClick={() => !isOccupied ? setOccupyModal(p) : isMine ? freePostazione(p.id) : null}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: isOccupied ? (isMine ? "#7F77DD" : "#A32D2D") : "#3B6D11", color: "#fff" }}>
                    {isOccupied ? (isMine ? "MIA" : "OCCUPATA") : "LIBERA"}
                  </span>
                  <span style={{ fontSize: 10, color: "#888" }}>{p.cappa}</span>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, margin: "4px 0 2px", color: "#333", lineHeight: 1.3 }}>{p.nome}</p>
                {isOccupied && (
                  <div>
                    <p style={{ fontSize: 11, color: isMine ? "#7F77DD" : "#A32D2D", margin: "2px 0" }}>👤 {p.occupied_by_name}</p>
                    {p.ora_inizio && <p style={{ fontSize: 11, color: "#888", margin: 0 }}>🕐 {p.ora_inizio.slice(0,5)}–{p.ora_fine?.slice(0,5)}</p>}
                    {p.attivita && <p style={{ fontSize: 10, color: "#aaa", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.attivita}</p>}
                    {isMine && <p style={{ fontSize: 10, color: "#7F77DD", margin: "4px 0 0", textAlign: "center" }}>Tocca per liberare</p>}
                  </div>
                )}
                {!isOccupied && <p style={{ fontSize: 10, color: "#3B6D11", margin: "4px 0 0", textAlign: "center" }}>Tocca per occupare</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL OCCUPA POSTAZIONE */}
      {occupyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.5rem", width: 340, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>📍 {occupyModal.nome}</p>
              <button onClick={() => setOccupyModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: "#7F77DD", margin: "0 0 12px" }}>{occupyModal.cappa}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Ora inizio</label>
                <input type="time" value={occupyForm.ora_inizio} onChange={e => setOccupyForm(f => ({ ...f, ora_inizio: e.target.value }))}
                  style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Ora fine</label>
                <input type="time" value={occupyForm.ora_fine} onChange={e => setOccupyForm(f => ({ ...f, ora_fine: e.target.value }))}
                  style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
            </div>
            <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Attività (opzionale)</label>
            <input type="text" value={occupyForm.attivita} onChange={e => setOccupyForm(f => ({ ...f, attivita: e.target.value }))}
              placeholder="es. Analisi campioni..."
              style={{ width: "100%", marginBottom: 14, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            <button onClick={occupyPostazione} style={{ width: "100%", padding: "9px", borderRadius: 8, border: "none", background: "#3B6D11", color: "#fff", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
              ✓ Occupa postazione
            </button>
          </div>
        </div>
      )}

      {/* REGISTRO PRESENZE */}
      <div style={{ borderTop: "0.5px solid #e0e0e0", paddingTop: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ flex: 1, fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "0.5px solid #ccc", minWidth: 140 }} />
          {filterDate && (
            <button onClick={() => setFilterDate("")} style={{ fontSize: 12, padding: "7px 10px", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent", color: "#888", cursor: "pointer" }}>
              ✕ Tutti
            </button>
          )}
          <button onClick={() => setShowForm(!showForm)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 6, border: "none", background: "#7F77DD", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
            <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Aggiungi presenza
          </button>
        </div>

        {showForm && (
          <div style={{ background: "#f9f9f9", borderRadius: 12, padding: "1rem", marginBottom: 16, border: "0.5px solid #e0e0e0" }}>
            <p style={{ fontWeight: 500, fontSize: 14, margin: "0 0 12px" }}>📅 Nuova presenza</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Ora inizio</label>
                <input type="time" value={form.ora_inizio} onChange={e => setForm(f => ({ ...f, ora_inizio: e.target.value }))}
                  style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Ora fine</label>
                <input type="time" value={form.ora_fine} onChange={e => setForm(f => ({ ...f, ora_fine: e.target.value }))}
                  style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 3 }}>Descrizione attività</label>
              <input type="text" value={form.attivita} onChange={e => setForm(f => ({ ...f, attivita: e.target.value }))}
                placeholder="es. Analisi GC-MS campioni biodiesel..."
                style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addPresenza} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: "#7F77DD", color: "#fff", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>✓ Conferma</button>
              <button onClick={() => setShowForm(false)} style={{ padding: "8px 14px", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent", color: "#888", fontSize: 13, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        )}

        {Object.keys(grouped).length === 0
          ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
              <i className="ti ti-calendar-off" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
              Nessuna presenza registrata
            </div>
          : Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(data => (
              <div key={data} style={{ marginBottom: 20 }}>
                <div style={{ background: "#EEEDFE", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#534AB7" }}>{fmtDate(data)}</span>
                  <span style={{ fontSize: 12, color: "#7F77DD", marginLeft: 8 }}>{grouped[data].length} {grouped[data].length === 1 ? "presenza" : "presenze"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grouped[data].sort((a,b) => a.ora_inizio.localeCompare(b.ora_inizio)).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.8rem 1rem", background: "#fff", border: `0.5px solid ${p.user_id === currentUser.id ? "#7F77DD" : "#e0e0e0"}`, borderRadius: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: p.user_id === currentUser.id ? "#EEEDFE" : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: p.user_id === currentUser.id ? "#7F77DD" : "#888", flexShrink: 0 }}>
                        {p.user_name.split(" ").map(n => n[0]).join("").slice(0,2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 500, fontSize: 13, margin: 0 }}>{p.user_name}</p>
                        <p style={{ fontSize: 12, color: "#7F77DD", margin: "2px 0" }}>🕐 {p.ora_inizio.slice(0,5)} — {p.ora_fine.slice(0,5)}</p>
                        {p.attivita && <p style={{ fontSize: 12, color: "#888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📋 {p.attivita}</p>}
                      </div>
                      {(p.user_id === currentUser.id || currentUser.role === "admin") && (
                        <button onClick={() => deletePresenza(p.id, p.user_id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12, flexShrink: 0 }}>
                          <i className="ti ti-trash" style={{ fontSize: 13 }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ─── PRESENZE CRONOLOGIA ADMIN ────────────────────────────────────────────────
function PresenzeCronologia() {
  const [presenze, setPresenze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from("presenze").select("*").order("data", { ascending: false }).order("ora_inizio"),
      supabase.from("users").select("id, name").order("name")
    ]).then(([{ data: p }, { data: u }]) => {
      setPresenze(p || []);
      setUsers(u || []);
      setLoading(false);
    });
  }, []);

  const filtered = presenze.filter(p => {
    const matchDate = !filterDate || p.data === filterDate;
    const matchUser = !filterUser || p.user_name.toLowerCase().includes(filterUser.toLowerCase());
    return matchDate && matchUser;
  });

  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  if (loading) return <div style={{ color: "#888", fontSize: 13 }}>Caricamento...</div>;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          style={{ flex: 1, fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "0.5px solid #ccc", minWidth: 130 }} />
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ flex: 1, fontSize: 13, padding: "6px 8px", borderRadius: 8, border: "0.5px solid #ccc", minWidth: 130 }}>
          <option value="">👤 Tutti gli utenti</option>
          {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        {(filterDate || filterUser) && (
          <button onClick={() => { setFilterDate(""); setFilterUser(""); }}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent", color: "#888", cursor: "pointer" }}>
            ✕ Reset
          </button>
        )}
      </div>

      {filtered.length === 0
        ? <p style={{ fontSize: 13, color: "#aaa" }}>Nessuna presenza trovata</p>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#534AB7", flexShrink: 0 }}>
                  {p.user_name.split(" ").map(n => n[0]).join("").slice(0,2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: 13, margin: 0 }}>{p.user_name}</p>
                  <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                    📅 {fmtDate(p.data)} · 🕐 {p.ora_inizio?.slice(0,5)}–{p.ora_fine?.slice(0,5)}
                    {p.attivita && <span style={{ color: "#aaa" }}> · {p.attivita}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
      }
      <p style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>{filtered.length} presenze trovate</p>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setError("");
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
    setLoading(true); setError("");
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    const { error: dbError } = await supabase.from("users").insert([{
      name: name.trim(), email: email.trim(), role: "researcher", status: "pending"
    }]);
    if (dbError) { setError("Errore: " + dbError.message); setLoading(false); return; }
    await sendEmailDirect(
      `Nuova richiesta di registrazione — ${name}`,
      `<h2>Nuova richiesta di registrazione</h2><p><b>${name}</b> (${email}) ha richiesto l'accesso all'app LTCE.</p><a href="https://luce-apparecchiature.vercel.app" style="background:#7F77DD;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Vai all'app</a>`
    );
    setSuccess("Richiesta inviata! L'admin approverà il tuo accesso a breve.");
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f7" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", width: 340, maxWidth: "90vw", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <i className="ti ti-flask" style={{ fontSize: 36, color: "#7F77DD" }} />
          <h2 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 600 }}>LTCE</h2>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{mode === "login" ? "Accedi" : "Richiedi accesso"}</p>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f5f5f5", borderRadius: 8, padding: 4 }}>
          <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === "login" ? "#fff" : "transparent", color: mode === "login" ? "#333" : "#888", fontWeight: mode === "login" ? 500 : 400, fontSize: 13, boxShadow: mode === "login" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>Accedi</button>
          <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === "register" ? "#fff" : "transparent", color: mode === "register" ? "#333" : "#888", fontWeight: mode === "register" ? 500 : 400, fontSize: 13, boxShadow: mode === "register" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>Registrati</button>
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
  const [form, setForm] = useState({ day: 0, slot: 0, note: "", metodo: "" });
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
      setUsers(u || []); setEquipment(e || []); setBookings(b || []);
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

  const sendEmail = async (type, details) => {
    let subject = "", html = "";
    if (type === "booking_created") {
      subject = `Nuova prenotazione — ${currentUser.name}`;
      html = `<h2>Nuova prenotazione</h2><p><b>${currentUser.name}</b> ha prenotato: <b>${details}</b></p>`;
    } else if (type === "booking_cancelled") {
      subject = `Prenotazione annullata — ${currentUser.name}`;
      html = `<h2>Prenotazione annullata</h2><p><b>${currentUser.name}</b> ha annullato: <b>${details}</b></p>`;
    }
    await sendEmailDirect(subject, html);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUsers([]); setEquipment([]); setBookings([]);
  };

  const isBooked = (equipId, day, slot) =>
    bookings.find(b => b.equip_id === equipId && b.day === day && b.slot === slot);

  const book = async () => {
    if (!form.metodo.trim()) return alert("Inserisci il metodo di analisi!");
    if (isBooked(modal.id, form.day, form.slot)) return alert("Slot già occupato!");
    const { data, error } = await supabase.from("bookings").insert([{
      equip_id: modal.id, user_id: currentUser.id, day: form.day, slot: form.slot, note: form.note, metodo: form.metodo
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
      name: userForm.name.trim(), email: userForm.email.trim(), role: userForm.role, status: "approved"
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

  const approveUser = async (userId) => {
    const { error } = await supabase.from("users").update({ status: "approved" }).eq("id", userId);
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "approved" } : u));
  };

  const rejectUser = async (userId) => {
    if (!window.confirm("Vuoi rifiutare e rimuovere questo utente?")) return;
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) return alert("Errore: " + error.message);
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} />;

  const myBookings = bookings.filter(b => b.user_id === currentUser.id);
  const pendingUsers = users.filter(u => u.status === "pending");

  const navBtn = (v, label, icon, badge) => (
    <button onClick={() => setView(v)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: view === v ? "#7F77DD" : "#f0f0f0", color: view === v ? "#fff" : "#666", fontWeight: view === v ? 500 : 400, fontSize: 13, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", position: "relative", flexShrink: 0 }}>
      <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize: 15 }} />{label}
      {badge > 0 && <span style={{ background: "#A32D2D", color: "#fff", borderRadius: "50%", fontSize: 10, padding: "1px 5px", marginLeft: 2 }}>{badge}</span>}
    </button>
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#666" }}>
      <i className="ti ti-loader-2" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />Caricamento...
    </div>
  );

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: "0.75rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10, borderBottom: "0.5px solid #e0e0e0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="ti ti-flask" style={{ fontSize: 20, color: "#7F77DD" }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>LTCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#888" }}>👤 {currentUser.name.split(" ")[0]}</span>
          <button onClick={logout} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #ccc", background: "transparent", color: "#888", cursor: "pointer" }}>
            <i className="ti ti-logout" style={{ fontSize: 12, verticalAlign: -2 }} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        {navBtn("catalog", "Strumenti", "microscope")}
        {navBtn("calendar", "Calendario", "calendar")}
        {navBtn("mybookings", "Prenotazioni", "bookmark")}
        {navBtn("inventory", "Inventario", "box")}
        {navBtn("presenze", "Presenze", "user-check")}
        {currentUser.role === "admin" && navBtn("admin", "Admin", "settings", pendingUsers.length)}
      </div>

      {/* CATALOG */}
      {view === "catalog" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {equipment.map(eq => {
            const busy = bookings.filter(b => b.equip_id === eq.id).length;
            const st = STATUS_STYLE[eq.status] || STATUS_STYLE.available;
            const catColor = CAT_COLORS[eq.category] || "#888";
            return (
              <div key={eq.id} style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: catColor + "22", color: catColor }}>{eq.category}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <p style={{ fontWeight: 500, fontSize: 14, margin: "6px 0 4px" }}>{eq.name}</p>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px" }}>{eq.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{busy} pren.</span>
                  {eq.status !== "maintenance" && (
                    <button onClick={() => { setModal(eq); setForm({ day: 0, slot: 0, note: "", metodo: "" }); }}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "0.5px solid #7F77DD", background: "transparent", color: "#7F77DD", cursor: "pointer" }}>
                      <i className="ti ti-calendar-plus" style={{ fontSize: 13, verticalAlign: -2, marginRight: 3 }} />Prenota
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
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Prossimi 7 giorni</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: "6px 6px", textAlign: "left", color: "#888", fontWeight: 500, borderBottom: "0.5px solid #e0e0e0", whiteSpace: "nowrap" }}>Slot</th>
                {DAYS.map((d, i) => <th key={i} style={{ padding: "6px 6px", textAlign: "center", color: "#888", fontWeight: 500, borderBottom: "0.5px solid #e0e0e0", minWidth: 70 }}>{fmt(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, si) => (
                <tr key={si}>
                  <td style={{ padding: "6px 6px", color: "#888", whiteSpace: "nowrap", borderBottom: "0.5px solid #e0e0e0", fontSize: 11 }}>{slot}</td>
                  {DAYS.map((_, di) => {
                    const dayBookings = bookings.filter(b => b.day === di && b.slot === si);
                    return (
                      <td key={di} style={{ padding: 3, textAlign: "center", borderBottom: "0.5px solid #e0e0e0" }}>
                        {dayBookings.length === 0
                          ? <span style={{ fontSize: 10, color: "#3B6D11", background: "#EAF3DE", padding: "2px 4px", borderRadius: 4 }}>libero</span>
                          : dayBookings.map(b => {
                              const eq = equipment.find(e => e.id === b.equip_id);
                              const usr = users.find(u => u.id === b.user_id);
                              return <div key={b.id} style={{ fontSize: 9, background: "#EEEDFE", color: "#534AB7", borderRadius: 4, padding: "2px 3px", marginBottom: 2 }}>{eq?.name.split(" ")[0]}<br /><span style={{ color: "#7F77DD" }}>{usr?.name.split(" ")[0]}</span></div>;
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
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="ti ti-flask" style={{ fontSize: 20, color: "#7F77DD" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{eq?.name}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                          {fmt(DAYS[b.day])} · {SLOTS[b.slot]}
                          {b.note && <span style={{ color: "#aaa" }}> · {b.note}</span>}
                        </p>
                      </div>
                      <button onClick={() => cancel(b.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12, flexShrink: 0 }}>
                        <i className="ti ti-trash" style={{ fontSize: 14, verticalAlign: -2 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}

      {/* PRESENZE */}
      {view === "presenze" && <PresenzeePage currentUser={currentUser} />}

      {/* INVENTORY */}
      {view === "inventory" && <InventoryPage currentUser={currentUser} />}

      {/* ADMIN */}
      {view === "admin" && currentUser.role === "admin" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Prenotazioni", value: bookings.length, icon: "calendar" },
              { label: "Strumenti", value: equipment.length, icon: "microscope" },
              { label: "Utenti", value: users.length, icon: "users" },
            ].map((m, i) => (
              <div key={i} style={{ background: "#f5f5f5", borderRadius: 8, padding: "0.8rem 1rem" }}>
                <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}><i className={`ti ti-${m.icon}`} style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />{m.label}</p>
                <p style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>{m.value}</p>
              </div>
            ))}
          </div>

          {pendingUsers.length > 0 && (
            <div style={{ background: "#FFFBEA", border: "0.5px solid #F0C040", borderRadius: 8, padding: "1rem", marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#856404", margin: "0 0 10px" }}>⏳ Richieste in attesa ({pendingUsers.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingUsers.map(u => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", padding: "0.7rem 1rem", borderRadius: 8, border: "0.5px solid #F0C040" }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{u.name}</p>
                      <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{u.email}</p>
                    </div>
                    <button onClick={() => approveUser(u.id)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#3B6D11", color: "#fff", cursor: "pointer" }}>✓ Approva</button>
                    <button onClick={() => rejectUser(u.id)} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "none", background: "#A32D2D", color: "#fff", cursor: "pointer" }}>✗ Rifiuta</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "20px 0 8px" }}>Gestione utenti</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome e cognome"
              style={{ flex: 1, minWidth: 120, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc" }} />
            <input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@lab.it"
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
            {users.filter(u => u.status !== "pending").map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 1rem", background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#534AB7", flexShrink: 0 }}>
                  {u.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: "#aaa", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
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
                    style={{ fontSize: 16, color: l.action.includes("creata") ? "#3B6D11" : "#A32D2D", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{l.action}</span>
                    {l.equipment_name && <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>— {l.equipment_name}</span>}
                    {l.details && <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>{l.details}</span>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{eq?.name}</span>
                    <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{fmt(DAYS[b.day])} · {SLOTS[b.slot]}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{usr?.name.split(" ")[0]}</span>
                  <button onClick={() => cancel(b.id)} style={{ background: "transparent", border: "0.5px solid #ccc", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#A32D2D", fontSize: 12, flexShrink: 0 }}>
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
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Metodo di analisi <span style={{ color: "#A32D2D" }}>*</span></label>
            <input value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}
              placeholder="es. GC-MS, HPLC, UV-Vis..."
              style={{ width: "100%", marginBottom: 12, fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "0.5px solid #ccc", boxSizing: "border-box" }} />
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