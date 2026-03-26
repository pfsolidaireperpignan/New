/* js/facturation.js - VERSION FINALE (COMPATIBLE ANCIENS & NOUVEAUX DOSSIERS) */
import { app, db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, getDoc, auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- INFOS BANCAIRES ---
const INFO_SOCIETE = {
    banque: "BANQUE POPULAIRE DU SUD",
    iban: "FR76 1660 7000 0738 2217 4454 393",
    conditions: "Paiement à réception."
};

let paiements = []; 
let cacheDepenses = []; 
let cacheFactures = []; 
let cacheClients = [];
let cacheDossiersAdmin = [];
let lastFactureCursor = null;
let hasMoreFactures = true;
const FACTURES_PAGE_SIZE = 60;
let currentDocSnapshot = null;
let quickFilter = "ALL"; // ALL | EN_RETARD | PAYE | PARTIEL | EMIS | BROUILLON
let global_CA = 0; 
let global_Depenses = 0; 
let logoBase64 = null; 
const storage = app ? getStorage(app) : getStorage();
const currentYear = new Date().getFullYear();
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const normalizeText = (v) => String(v || "").trim().toLowerCase();

// --- INIT ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        chargerLogoBase64();
        initYearFilter();
        window.chargerListeFactures();
        window.chargerDepenses();
        chargerSuggestionsClients();
        if(document.getElementById('dep_date_fac')) document.getElementById('dep_date_fac').valueAsDate = new Date();
        
        const el = document.getElementById('tbody_lignes');
        if(el && window.Sortable) {
            new Sortable(el, { handle: '.drag-handle', animation: 150, onEnd: window.calculTotal });
        }
    }
});

function initYearFilter() {
    const opts = `<option value="">Année (Toutes)</option>` + 
                 [0,1,2].map(i => `<option value="${currentYear-i}" ${i===0?'selected':''}>${currentYear-i}</option>`).join('');
    
    if(document.getElementById('filter_year')) document.getElementById('filter_year').innerHTML = opts;
    if(document.getElementById('filter_fac_year')) document.getElementById('filter_fac_year').innerHTML = opts;
}

function chargerLogoBase64() { 
    const img = document.getElementById('logo-source'); 
    if (img && img.naturalWidth > 0) { 
        const c = document.createElement("canvas"); 
        c.width=img.naturalWidth; c.height=img.naturalHeight; 
        c.getContext("2d").drawImage(img,0,0); 
        try{logoBase64=c.toDataURL("image/png");}catch(e){} 
    } 
}

// --- 1. FACTURES / DEVIS ---
function computeFactureStatut(d) {
    const raw = String(d.statut || "").trim().toUpperCase();
    if (raw) return raw;

    // Compat ancien
    if ((d.finalType || d.type || d.info?.type) === "DEVIS") {
        const legacy = String(d.statut_doc || "").toLowerCase();
        if (legacy.includes("sans suite")) return "ANNULE";
        if (legacy) return "BROUILLON";
        return "BROUILLON";
    }

    const total = Number.isFinite(d.finalTotal) ? d.finalTotal : parseFloat(d.total || d.info?.total || 0);
    const paye = (d.finalPaiements || d.paiements || []).reduce((s, p) => s + parseFloat(p.montant), 0);
    const reste = total - paye;

    if (paye <= 0) return "EMIS";
    if (reste > 0.01) return "PARTIEL";
    return "PAYE";
}

function updateLoadMoreButton() {
    const btn = document.getElementById('btn-load-more-factures');
    if (!btn) return;
    if (hasMoreFactures) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
}

function setEditorActionButtonsVisibility() {
    const type = document.getElementById('doc_type')?.value;
    const statut = String(document.getElementById('doc_statut')?.value || "").toUpperCase();
    const hasId = Boolean(document.getElementById('current_doc_id')?.value);

    const btnAnnuler = document.getElementById('btn-annuler-doc');
    if (!btnAnnuler) return;

    const canAnnuler = hasId && (type === "FACTURE") && statut !== "ANNULE";

    btnAnnuler.style.display = canAnnuler ? 'inline-flex' : 'none';
}

function formatDateFR(value) {
    if (!value) return "-";
    try { return new Date(value).toLocaleDateString('fr-FR'); } catch(_) { return String(value); }
}

function getAEncaisserRows() {
    return cacheFactures
        .filter(d => String(d.finalType || "").toUpperCase() === "FACTURE")
        .map(d => {
            const paye = (d.finalPaiements || []).reduce((s, p) => s + (parseFloat(p?.montant) || 0), 0);
            const reste = (parseFloat(d.finalTotal) || 0) - paye;
            return { ...d, reste };
        })
        .filter(d => d.reste > 0.01 && !["PAYE", "ANNULE", "AVOIR"].includes(String(d.finalStatut || "").toUpperCase()))
        .sort((a, b) => {
            const da = a.finalEcheance ? new Date(a.finalEcheance).getTime() : Number.MAX_SAFE_INTEGER;
            const db = b.finalEcheance ? new Date(b.finalEcheance).getTime() : Number.MAX_SAFE_INTEGER;
            return da - db;
        });
}

function renderAEncaisserTable() {
    const tbody = document.getElementById('encaisser-body');
    if (!tbody) return;
    const rows = getAEncaisserRows();
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Aucun impayé.</td></tr>';
        return;
    }
    tbody.innerHTML = "";
    rows.forEach(r => {
        const tr = document.createElement('tr');
        const overdue = r.finalEcheance && new Date(r.finalEcheance) < new Date(new Date().toDateString());
        tr.innerHTML = `
            <td><strong>${escapeHtml(r.finalNumero || "-")}</strong></td>
            <td>${escapeHtml(r.finalClient || "-")}</td>
            <td><span class="${overdue ? 'echeance echeance-retard' : 'echeance'}">${escapeHtml(formatDateFR(r.finalEcheance))}</span></td>
            <td style="text-align:right; font-weight:700; color:#b91c1c;">${r.reste.toFixed(2)} €</td>
            <td>${escapeHtml(String(r.finalStatut || "EMIS").toUpperCase())}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.exportAEncaisserCSV = function() {
    const rows = getAEncaisserRows();
    let csv = "Numero;Client;Echeance;Reste Du;Statut\n";
    rows.forEach(r => {
        csv += `${r.finalNumero || ""};${r.finalClient || ""};${r.finalEcheance || ""};${r.reste.toFixed(2)};${String(r.finalStatut || "EMIS").toUpperCase()}\n`;
    });
    const encoded = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", "a_encaisser.csv");
    document.body.appendChild(link);
    link.click();
};

async function uploadPaymentReceipt(file, numeroDoc = "DOC") {
    if (!file) return { url: "", path: "" };
    const ct = String(file.type || "").toLowerCase();
    const isAllowed = ct.startsWith("image/") || ct === "application/pdf";
    if (!isAllowed) throw new Error("Format justificatif non supporté (image/PDF).");
    if (file.size > 10 * 1024 * 1024) throw new Error("Fichier trop volumineux (max 10 Mo).");
    const safeName = String(file.name || "justificatif").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `ged_files/receipt_${String(numeroDoc || "DOC").replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}_${safeName}`;
    const fileRef = ref(storage, filePath);
    await uploadBytes(fileRef, file, { contentType: ct || "application/octet-stream" });
    const url = await getDownloadURL(fileRef);
    return { url, path: filePath };
}

function summarizePaiements(list, total) {
    const items = Array.isArray(list) ? list : [];
    const totalPaye = items.reduce((s, p) => s + (parseFloat(p?.montant) || 0), 0);
    const reste = (parseFloat(total) || 0) - totalPaye;

    let lastDate = "";
    items.forEach(p => {
        const d = String(p?.date || "").trim();
        if (d && (!lastDate || d > lastDate)) lastDate = d;
    });

    const modeCount = {};
    items.forEach(p => {
        const m = String(p?.mode || "").trim() || "Autre";
        modeCount[m] = (modeCount[m] || 0) + 1;
    });
    let mainMode = "-";
    let best = 0;
    Object.keys(modeCount).forEach(k => {
        if (modeCount[k] > best) { best = modeCount[k]; mainMode = k; }
    });

    return { totalPaye, reste, lastDate: lastDate || "-", mainMode };
}

window.chargerListeFactures = async function(reset = true) {
    const tbody = document.getElementById('list-body');
    if(!tbody) return;
    if (reset) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center">Chargement...</td></tr>';
    
    try {
        if (reset) {
            global_CA = 0;
            cacheFactures = [];
            lastFactureCursor = null;
            hasMoreFactures = true;
        }

        let q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(FACTURES_PAGE_SIZE));
        if (!reset && lastFactureCursor) q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), startAfter(lastFactureCursor), limit(FACTURES_PAGE_SIZE));
        const snap = await getDocs(q);

        if (snap.empty) {
            hasMoreFactures = false;
            if (reset) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#94a3b8;">Aucun document.</td></tr>';
            updateLoadMoreButton();
            return;
        }

        lastFactureCursor = snap.docs[snap.docs.length - 1] || lastFactureCursor;
        hasMoreFactures = snap.size === FACTURES_PAGE_SIZE;
        
        snap.forEach((docSnap) => {
            const d = docSnap.data(); d.id = docSnap.id;
            
            // COMPATIBILITÉ (Ancien vs Nouveau format pour la liste)
            d.finalNumero = d.numero || d.info?.numero || "BROUILLON";
            d.finalDate = d.date || d.info?.date || d.date_document || d.date_creation;
            d.finalType = d.type || d.info?.type || "DEVIS";
            d.finalTotal = parseFloat((d.total !== undefined) ? d.total : (d.info?.total || 0));
            d.finalClient = d.client_nom || d.client?.nom || "Inconnu";
            d.finalDefunt = d.defunt_nom || d.defunt?.nom || "";
            d.finalDossierNumero = d.dossier_numero || "-";
            d.finalPaiements = d.paiements || [];
            d.finalStatut = computeFactureStatut(d);
            d.finalEcheance = d.date_echeance || "";
            
            if(d.finalType === 'DEVIS' && !d.statut_doc) d.statut_doc = 'En cours';
            
            cacheFactures.push(d);
            
            if (d.finalType === "FACTURE" && new Date(d.date_creation).getFullYear() === currentYear) global_CA += d.finalTotal;
        });
        updateLoadMoreButton();
        window.filtrerFactures();
        window.chargerDepenses();
        renderAEncaisserTable();
    } catch(e) { console.error(e); }
};

window.chargerPlusFactures = async function() {
    await window.chargerListeFactures(false);
};

window.setQuickFilter = function(value) {
    quickFilter = String(value || "ALL").toUpperCase();
    document.querySelectorAll('.quick-filter').forEach(btn => btn.classList.remove('active'));
    const map = {
        ALL: 0,
        EN_RETARD: 1,
        PAYE: 2,
        PARTIEL: 3,
        EMIS: 4,
        BROUILLON: 5
    };
    const idx = map[quickFilter];
    const list = document.querySelectorAll('.quick-filter');
    if (Number.isInteger(idx) && list[idx]) list[idx].classList.add('active');
    window.filtrerFactures();
};

window.filtrerFactures = function() {
    const term = (document.getElementById('search-facture')?.value || "").toLowerCase();
    
    const fMonth = document.getElementById('filter_fac_month')?.value;
    const fYear = document.getElementById('filter_fac_year')?.value;
    const fType = document.getElementById('filter_fac_type')?.value;
    const fStatut = document.getElementById('filter_fac_statut')?.value;

    const tbody = document.getElementById('list-body'); tbody.innerHTML = "";
    
    function isOverdue(d) {
        const statut = String(d.finalStatut || "").toUpperCase();
        if (statut === "PAYE" || statut === "ANNULE" || statut === "AVOIR") return false;
        const e = d.finalEcheance || d.date_echeance || "";
        if (!e) return false;
        try {
            const due = new Date(e);
            const now = new Date();
            now.setHours(0,0,0,0);
            due.setHours(0,0,0,0);
            return due < now;
        } catch(_) { return false; }
    }

    const results = cacheFactures.filter(d => {
        const numero = (d.finalNumero || "").toLowerCase();
        const client = (d.finalClient || "").toLowerCase();
        const defunt = (d.finalDefunt || "").toLowerCase();
        const dossierNumero = (d.finalDossierNumero || "").toLowerCase();
        const textMatch = numero.includes(term) || client.includes(term) || defunt.includes(term) || dossierNumero.includes(term);
        const typeMatch = !fType || fType === "" || d.finalType === fType;

        let dateMatch = true;
        const dDate = new Date(d.finalDate);
        if (fYear && fYear !== "" && dDate.getFullYear() != fYear) dateMatch = false;
        if (fMonth && fMonth !== "" && dDate.getMonth() != fMonth) dateMatch = false;

        let statutMatch = true;
        if (fStatut && fStatut !== "") {
            if (d.finalType === 'FACTURE') {
                const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0);
                const reste = d.finalTotal - paye;
                const isPaye = reste < 0.1;
                
                if (fStatut === "Payé" && !isPaye) statutMatch = false;
                if (fStatut === "En attente" && isPaye) statutMatch = false;
                if (fStatut.includes("Devis")) statutMatch = false; 
            }
            else if (d.finalType === 'DEVIS') {
                if (fStatut === "Payé" || fStatut === "En attente") statutMatch = false;
                if (fStatut === "Devis En cours" && (d.statut_doc === "Sans suite" || d.statut_doc === "Validé")) statutMatch = false;
                if (fStatut === "Devis Sans suite" && d.statut_doc !== "Sans suite") statutMatch = false;
            }
        } else {
            if (d.finalType === 'DEVIS' && d.statut_doc === "Sans suite") statutMatch = false;
        }

        let quickMatch = true;
        if (quickFilter && quickFilter !== "ALL") {
            if (quickFilter === "EN_RETARD") quickMatch = isOverdue(d);
            else quickMatch = String(d.finalStatut || "").toUpperCase() === quickFilter;
        }

        return textMatch && typeMatch && dateMatch && statutMatch && quickMatch;
    });
    
    if(results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#94a3b8;">Aucun document trouvé.</td></tr>';
        return;
    }

    function statutBadge(statut) {
        const s = String(statut || "").toUpperCase();
        if (s === "PAYE") return { cls: "badge-statut badge-statut-paye", label: "PAYÉ" };
        if (s === "PARTIEL") return { cls: "badge-statut badge-statut-partiel", label: "PARTIEL" };
        if (s === "EMIS") return { cls: "badge-statut badge-statut-emis", label: "ÉMIS" };
        if (s === "ANNULE") return { cls: "badge-statut badge-statut-annule", label: "ANNULÉ" };
        if (s === "AVOIR") return { cls: "badge-statut badge-statut-avoir", label: "AVOIR" };
        return { cls: "badge-statut badge-statut-brouillon", label: "BROUILLON" };
    }

    function formatDateISOToFR(iso) {
        if (!iso) return "-";
        try { return new Date(iso).toLocaleDateString('fr-FR'); } catch(e) { return String(iso); }
    }

    results.forEach(d => {
        const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0);
        const reste = d.finalTotal - paye;
        let dateAffiche = "-";
        try { dateAffiche = new Date(d.finalDate).toLocaleDateString(); } catch(e){}
        
        let badgeClass = d.finalType === 'FACTURE' ? 'badge-facture' : 'badge-devis';
        let statusColor = reste > 0.1 ? '#ef4444' : '#10b981'; 
        
        let rowStyle = "";
        let classerBtn = "";
        let statutText = d.finalType;

        if (d.finalType === 'DEVIS') {
            if (d.statut_doc === 'Validé') {
                statutText = "DEVIS";
                badgeClass = "badge-devis"; 
                classerBtn = `<div style="width:34px; text-align:center; color:#10b981; font-size:1.2rem;" title="Déjà facturé"><i class="fas fa-check-circle"></i></div>`;
            } 
            else if (d.statut_doc === 'Sans suite') {
                rowStyle = "background-color:#f3f4f6; color:#9ca3af; text-decoration:line-through;";
                badgeClass = "badge-gris"; 
                statutText = "SANS SUITE";
                classerBtn = `<button class="btn-icon" style="color:#10b981;" onclick="window.classerSansSuite('${d.id}', 'En cours')" title="Réactiver"><i class="fas fa-undo"></i></button>`;
            } 
            else {
                statutText = "DEVIS";
                badgeClass = "badge-devis";
                classerBtn = `<button class="btn-icon" style="color:#6b7280;" onclick="window.classerSansSuite('${d.id}', 'Sans suite')" title="Classer Sans Suite"><i class="fas fa-archive"></i></button>`;
            }
        }

        const st = statutBadge(d.finalStatut);
        const overdue = isOverdue(d);
        const echeanceFR = formatDateISOToFR(d.finalEcheance);
        const dossierLabel = d.finalDossierNumero || "-";

        const tr = document.createElement('tr');
        tr.style = rowStyle;
        if (overdue) tr.style = (tr.style ? (tr.style + ";") : "") + "box-shadow: inset 4px 0 0 #ef4444;";
        tr.innerHTML = `
            <td class="link-doc" onclick="window.chargerDocument('${d.id}')" style="cursor:pointer; color:#3b82f6;"><strong>${escapeHtml(d.finalNumero)}</strong></td>
            <td>${dateAffiche}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(statutText)}</span></td>
            <td><span class="${st.cls}">${escapeHtml(st.label)}</span></td>
            <td><span class="${overdue ? 'echeance echeance-retard' : 'echeance'}">${escapeHtml(echeanceFR)}</span></td>
            <td>${escapeHtml(dossierLabel)}</td>
            <td><strong>${escapeHtml(d.finalClient)}</strong></td>
            <td>${escapeHtml(d.finalDefunt)}</td>
            <td style="text-align:right;">${d.finalTotal.toFixed(2)} €</td>
            <td style="text-align:right; font-weight:bold; color:${statusColor};">${reste.toFixed(2)} €</td>
            <td style="text-align:center; display:flex; justify-content:center; gap:5px;">
                <button class="btn-icon" onclick="window.apercuDocument('${d.id}')" title="Aperçu PDF"><i class="fas fa-eye"></i></button>
                ${classerBtn}
                ${d.finalType === 'FACTURE' ? `<button class="btn-icon" style="color:#dc2626;" onclick="window.annulerDocumentById('${d.id}')" title="Annuler"><i class="fas fa-ban"></i></button>` : ``}
                <button class="btn-icon" style="color:red;" onclick="window.supprimerDocument('${d.id}')" title="Supprimer (admin)"><i class="fas fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });
};

window.classerSansSuite = async function(id, etat) {
    if(!confirm(etat === 'Sans suite' ? "Classer ce devis 'Sans suite' ?" : "Réactiver ce devis ?")) return;
    try {
        await updateDoc(doc(db, "factures_v2", id), { statut_doc: etat });
        window.chargerListeFactures();
    } catch(e) { alert("Erreur: " + e.message); }
};

// --- APERÇU DOCUMENT (AVEC CORRECTIF COMPATIBILITÉ) ---
window.apercuDocument = async function(id) {
    try {
        const docSnap = await getDoc(doc(db, "factures_v2", id));
        if (!docSnap.exists()) { alert("Document introuvable."); return; }
        const data = docSnap.data();

        // ⚠️ LOGIQUE DE RÉCUPÉRATION HYBRIDE (NOUVEAU || ANCIEN)
        const pdfData = {
            client: { 
                // Cherche 'client_nom' (nouveau) OU 'client.nom' (ancien)
                nom: data.client_nom || data.client?.nom || "Inconnu", 
                adresse: data.client_adresse || data.client?.adresse || "", 
                civility: data.client_civility || data.client?.civility || '' 
            },
            defunt: { 
                nom: data.defunt_nom || data.defunt?.nom || "", 
                naiss: data.defunt_date_naiss || data.defunt?.naiss || "", 
                deces: data.defunt_date_deces || data.defunt?.deces || "" 
            },
            info: { 
                type: data.type || data.info?.type || "DOC", 
                date: data.date || data.info?.date || new Date().toISOString(), 
                numero: data.numero || data.info?.numero || "Brouillon", 
                // Calcul du total sécurisé pour éviter le NaN
                total: parseFloat((data.total !== undefined) ? data.total : (data.info?.total || 0)) 
            },
            lignes: data.lignes || [],
            paiements: data.paiements || []
        };

        window.generatePDFFromData(pdfData, false);

    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'aperçu : " + e.message);
    }
};

// --- 2. DEPENSES ---
window.toggleNewExpenseForm = function() { const c = document.getElementById('container-form-depense'); c.classList.toggle('open'); if(!c.classList.contains('open')) window.resetFormDepense(); };

window.chargerDepenses = async function() { 
    try { 
        const q = query(collection(db, "depenses"), orderBy("date", "desc")); 
        const snap = await getDocs(q); 
        cacheDepenses = []; global_Depenses = 0; 
        const suppliers = new Set(); 
        
        snap.forEach(docSnap => { 
            const data = docSnap.data(); 
            data.id = docSnap.id; 
            cacheDepenses.push(data); 
            if(new Date(data.date).getFullYear() === currentYear && data.statut === 'Réglé') {
                global_Depenses += (parseFloat(data.montant) || 0); 
            }
            if(data.fournisseur) suppliers.add(data.fournisseur); 
        }); 
        
        updateFinancialDashboard(); 
        window.filtrerDepenses(); 
        updateFournisseursList(suppliers); 
    } catch(e) {} 
};

function updateFinancialDashboard() { 
    document.getElementById('stat-ca').innerText = global_CA.toFixed(2) + " €"; 
    document.getElementById('stat-depenses').innerText = global_Depenses.toFixed(2) + " €"; 
    document.getElementById('stat-resultat').innerText = (global_CA - global_Depenses).toFixed(2) + " €"; 
}

function updateFournisseursList(suppliers) { 
    const dl = document.getElementById('fournisseurs_list'); 
    if(dl) dl.innerHTML = Array.from(suppliers).map(s => `<option value="${s}">`).join(''); 
}

window.filtrerDepenses = function() { 
    const term = (document.getElementById('search_depense')?.value || "").toLowerCase();
    const selMonth = document.getElementById('filter_month')?.value; 
    const selYear = document.getElementById('filter_year')?.value;   
    const cat = document.getElementById('filter_cat')?.value;
    const statut = document.getElementById('filter_statut')?.value;

    const tbody = document.getElementById('depenses-body'); 
    if(!tbody) return;
    tbody.innerHTML = ""; 

    const filtered = cacheDepenses.filter(d => { 
        const textMatch = (d.fournisseur + " " + (d.details||"") + " " + d.categorie).toLowerCase().includes(term);
        const catMatch = !cat || cat === "" || d.categorie === cat;
        const statutMatch = !statut || statut === "" || d.statut === statut;
        
        let dateMatch = true;
        const dDate = new Date(d.date);
        if (selYear && selYear !== "" && dDate.getFullYear() != selYear) dateMatch = false;
        if (selMonth && selMonth !== "" && dDate.getMonth() != selMonth) dateMatch = false;

        return textMatch && catMatch && statutMatch && dateMatch;
    }); 

    const totalFilter = filtered.reduce((s, d) => s + (parseFloat(d.montant) || 0), 0); 
    const displayTotal = document.getElementById('total-filtre-display');
    if(displayTotal) displayTotal.innerText = totalFilter.toFixed(2) + " €"; 

    filtered.forEach(d => { 
        const badge = d.statut==='Réglé' 
            ? `<span class="badge badge-regle">Réglé</span>` 
            : `<span class="badge badge-attente" onclick="window.marquerCommeRegle('${d.id}')">En attente</span>`; 
        
        let dateRegleHtml = "";
        if (d.statut === 'Réglé' && d.date_reglement) {
            dateRegleHtml = `<br><span style="font-size:0.7rem; color:#059669;"><i class="fas fa-check"></i> Réglé le ${new Date(d.date_reglement).toLocaleDateString()}</span>`;
        }
        const detailsHtml = d.details ? `<br><span style="font-size:0.8rem; color:#6b7280; font-style:italic;">${escapeHtml(d.details)}</span>` : "";

        const tr = document.createElement('tr'); 
        tr.innerHTML = `
            <td><span style="font-weight:600;">${new Date(d.date).toLocaleDateString()}</span>${dateRegleHtml}</td>
            <td><strong>${escapeHtml(d.fournisseur)}</strong>${detailsHtml}<br><small style="color:#d97706; font-size:0.75rem;">${escapeHtml(d.categorie)}</small></td>
            <td>${escapeHtml(d.reference||'-')}</td>
            <td>${badge}</td>
            <td style="text-align:right;">-${parseFloat(d.montant).toFixed(2)} €</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.preparerModification('${d.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="window.supprimerDepense('${d.id}')"><i class="fas fa-trash"></i></button>
            </td>`; 
        tbody.appendChild(tr); 
    }); 
};

window.gererDepense = async function() { 
    const id = document.getElementById('dep_edit_id').value; 
    const data = { 
        date: document.getElementById('dep_date_fac').value, reference: document.getElementById('dep_ref').value, fournisseur: document.getElementById('dep_fourn').value, 
        details: document.getElementById('dep_details').value, categorie: document.getElementById('dep_cat').value, mode: document.getElementById('dep_mode').value, 
        statut: document.getElementById('dep_statut').value, montant: parseFloat(document.getElementById('dep_montant').value) || 0, date_reglement: document.getElementById('dep_date_reg').value 
    }; 
    if(!data.date) return alert("Date requise"); 
    try { 
        if(id) { await updateDoc(doc(db, "depenses", id), data); alert("✅ Modifié !"); } 
        else { await addDoc(collection(db, "depenses"), data); } 
        window.resetFormDepense(); document.getElementById('container-form-depense').classList.remove('open'); window.chargerDepenses(); 
    } catch(e){alert(e.message);} 
};

window.resetFormDepense = function() { document.getElementById('dep_edit_id').value = ""; document.getElementById('form-depense').reset(); document.getElementById('btn-action-depense').innerHTML="ENREGISTRER"; };
window.preparerModification = function(id) { 
    const d = cacheDepenses.find(x=>x.id===id); 
    if(d) { 
        document.getElementById('dep_edit_id').value=id; document.getElementById('dep_date_fac').value=d.date; document.getElementById('dep_ref').value=d.reference; 
        document.getElementById('dep_fourn').value=d.fournisseur; document.getElementById('dep_montant').value=d.montant; document.getElementById('dep_cat').value=d.categorie; 
        document.getElementById('dep_details').value = d.details || ""; 
        document.getElementById('dep_mode').value=d.mode; document.getElementById('dep_statut').value=d.statut; 
        document.getElementById('btn-action-depense').innerHTML="MODIFIER"; document.getElementById('container-form-depense').classList.add('open'); 
    } 
};
window.marquerCommeRegle = async function(id) { if(confirm("Valider paiement ?")) { await updateDoc(doc(db, "depenses", id), { statut: "Réglé", date_reglement: new Date().toISOString().split('T')[0] }); window.chargerDepenses(); } };
window.supprimerDepense = async (id) => { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"depenses",id)); window.chargerDepenses(); } };

// --- 3. UI GENERALE ---
window.showDashboard = function() { document.getElementById('view-editor').classList.add('hidden'); document.getElementById('view-dashboard').classList.remove('hidden'); window.chargerListeFactures(); };
window.switchTab = function(tab) { document.getElementById('tab-factures').classList.add('hidden'); document.getElementById('tab-achats').classList.add('hidden'); document.getElementById('btn-tab-factures').classList.remove('active'); document.getElementById('btn-tab-achats').classList.remove('active'); if(tab === 'factures') { document.getElementById('tab-factures').classList.remove('hidden'); document.getElementById('btn-tab-factures').classList.add('active'); } else { document.getElementById('tab-achats').classList.remove('hidden'); document.getElementById('btn-tab-achats').classList.add('active'); window.chargerDepenses(); } };
window.nouveauDocument = function() {
    currentDocSnapshot = null;
    document.getElementById('current_doc_id').value = "";
    document.getElementById('doc_numero').value = "Auto";
    document.getElementById('client_nom').value = "";
    if(document.getElementById('client_id')) document.getElementById('client_id').value = "";
    document.getElementById('client_adresse').value = "";
    if(document.getElementById('client_info')) document.getElementById('client_info').value = "";
    document.getElementById('defunt_nom').value = "";
    document.getElementById('doc_type').value = "DEVIS";
    if(document.getElementById('doc_statut')) document.getElementById('doc_statut').value = "BROUILLON";
    if(document.getElementById('doc_echeance')) document.getElementById('doc_echeance').value = "";
    if(document.getElementById('dossier_numero')) document.getElementById('dossier_numero').value = "";
    if(document.getElementById('dossier_id')) document.getElementById('dossier_id').value = "";
    document.getElementById('tbody_lignes').innerHTML = "";
    paiements = [];
    window.renderPaiements();
    window.calculTotal();
    document.getElementById('btn-transform').style.display = 'none';
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-editor').classList.remove('hidden');
    const lastDateEl = document.getElementById('pay_last_date');
    const mainModeEl = document.getElementById('pay_main_mode');
    if (lastDateEl) lastDateEl.innerText = "-";
    if (mainModeEl) mainModeEl.innerText = "-";
    setEditorActionButtonsVisibility();
};

// CHARGEMENT DOCUMENT
window.chargerDocument = async (id) => { 
    const d = await getDoc(doc(db,"factures_v2",id)); 
    if(d.exists()) { 
        const data = d.data(); 
        currentDocSnapshot = data;
        document.getElementById('current_doc_id').value = id; 
        
        // COMPATIBILITÉ CHARGEMENT
        document.getElementById('doc_numero').value = data.numero || data.info?.numero; 
        if(document.getElementById('client_id')) document.getElementById('client_id').value = data.client_id || "";
        document.getElementById('client_nom').value = data.client_nom || data.client?.nom; 
        document.getElementById('client_adresse').value = data.client_adresse || data.client?.adresse; 
        const clientInfoEl = document.getElementById('client_info');
        if (clientInfoEl) clientInfoEl.value = data.client_info || data.client?.info || "";
        const civility = data.client_civility || data.client?.civility || 'M.';
        document.getElementById('client_civility').value = civility;

        document.getElementById('defunt_nom').value = data.defunt_nom || data.defunt?.nom;
        document.getElementById('defunt_date_naiss').value = data.defunt_date_naiss || data.defunt?.date_naiss || "";
        document.getElementById('defunt_date_deces').value = data.defunt_date_deces || data.defunt?.date_deces || "";
        if(document.getElementById('doc_statut')) document.getElementById('doc_statut').value = (data.statut || computeFactureStatut({ ...data, finalType: (data.type || data.info?.type), finalTotal: parseFloat(data.total || data.info?.total || 0), finalPaiements: (data.paiements || []) }) || "BROUILLON");
        if(document.getElementById('doc_echeance')) document.getElementById('doc_echeance').value = data.date_echeance || "";
        if(document.getElementById('dossier_numero')) document.getElementById('dossier_numero').value = data.dossier_numero || "";
        if(document.getElementById('dossier_id')) document.getElementById('dossier_id').value = data.dossier_id || "";
        
        document.getElementById('doc_type').value = data.type || data.info?.type; 
        document.getElementById('doc_date').value = data.date || data.info?.date; 
        document.getElementById('tbody_lignes').innerHTML = ""; 
        
        if(data.lignes) data.lignes.forEach(l => { if(l.type==='section') window.ajouterSection(l.text); else window.ajouterLigne(l.desc, l.prix, l.cat); }); 
        
        paiements = data.paiements || []; 
        window.renderPaiements(); window.calculTotal(); 
        const lettrage = summarizePaiements(paiements, parseFloat(data.total || data.info?.total || 0));
        const lastDateEl = document.getElementById('pay_last_date');
        const mainModeEl = document.getElementById('pay_main_mode');
        if (lastDateEl) lastDateEl.innerText = lettrage.lastDate;
        if (mainModeEl) mainModeEl.innerText = lettrage.mainMode;
        document.getElementById('btn-transform').style.display = (document.getElementById('doc_type').value === 'DEVIS') ? 'block' : 'none'; 
        document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-editor').classList.remove('hidden'); 
        setEditorActionButtonsVisibility();
    } 
};

// AJOUT LIGNE
window.ajouterLigne = function(desc="", prix=0, type="Courant") { 
    if(type === 'Avance') type = 'Courant';
    const tr = document.createElement('tr'); 
    tr.className = "row-item"; 
    tr.innerHTML = `<td class="drag-handle"><i class="fas fa-grip-lines" style="color:#cbd5e1; cursor:grab;"></i></td><td><input type="text" class="input-cell val-desc" value="${escapeHtml(desc)}"></td><td><select class="input-cell val-type"><option value="Courant" ${type==='Courant'?'selected':''}>Courant</option><option value="Optionnel" ${type==='Optionnel'?'selected':''}>Optionnel</option></select></td><td style="text-align:right;"><input type="number" class="input-cell val-prix" value="${prix}" step="0.01" oninput="window.calculTotal()"></td><td style="text-align:center;"><i class="fas fa-trash" style="color:red;cursor:pointer;" onclick="this.closest('tr').remove(); window.calculTotal();"></i></td>`; 
    document.getElementById('tbody_lignes').appendChild(tr); 
    window.calculTotal(); 
};

// AJOUT SECTION
window.ajouterSection = function(titre="SECTION") { 
    const tr = document.createElement('tr'); 
    tr.className = "row-section"; 
    tr.innerHTML = `
        <td class="drag-handle"><i class="fas fa-grip-lines" style="color:#f97316; cursor:grab;"></i></td>
        <td colspan="4">
            <input type="text" class="input-cell input-section" value="${escapeHtml(titre)}" style="font-weight:bold; color:#c2410c; background-color:#ffedd5; border:1px solid #fed7aa;">
        </td>
        <td style="text-align:center;"><i class="fas fa-trash" style="color:red;cursor:pointer;" onclick="this.closest('tr').remove(); window.calculTotal();"></i></td>`; 
    document.getElementById('tbody_lignes').appendChild(tr); 
};

window.calculTotal = function() {
    let total = 0;
    document.querySelectorAll('.val-prix').forEach(i => total += parseFloat(i.value) || 0);
    const lettrage = summarizePaiements(paiements, total);
    document.getElementById('total_general').innerText = total.toFixed(2) + " €";
    document.getElementById('total_paye').innerText = lettrage.totalPaye.toFixed(2) + " €";
    document.getElementById('reste_a_payer').innerText = lettrage.reste.toFixed(2) + " €";
    document.getElementById('total_display').innerText = total.toFixed(2);
    const lastDateEl = document.getElementById('pay_last_date');
    const mainModeEl = document.getElementById('pay_main_mode');
    if (lastDateEl) lastDateEl.innerText = lettrage.lastDate;
    if (mainModeEl) mainModeEl.innerText = lettrage.mainMode;
};

async function ensureClientLinkOnSave() {
    const idEl = document.getElementById('client_id');
    const nom = document.getElementById('client_nom')?.value || "";
    const adresse = document.getElementById('client_adresse')?.value || "";
    const info = document.getElementById('client_info')?.value || "";
    let clientId = idEl?.value || "";
    if (!nom) return clientId;
    if (clientId) return clientId;

    // 1) cache local
    const fromCache = findClientByName(nom);
    if (fromCache?.id) {
        clientId = fromCache.id;
        if (idEl) idEl.value = clientId;
        return clientId;
    }

    // 2) Firestore
    try {
        const snap = await getDocs(query(collection(db, "clients"), where("nom", "==", nom), limit(5)));
        if (!snap.empty) {
            const first = snap.docs[0];
            clientId = first.id;
            if (idEl) idEl.value = clientId;
            cacheClients.push({ id: first.id, ...(first.data() || {}) });
            return clientId;
        }
    } catch (_) {}

    // 3) création automatique NON BLOQUANTE
    try {
        const now = new Date().toISOString();
        const created = await addDoc(collection(db, "clients"), {
            nom,
            adresse,
            telephone: "",
            email: "",
            type: "particulier",
            notes: info,
            created_at: now,
            updated_at: now
        });
        clientId = created.id;
        if (idEl) idEl.value = clientId;
        cacheClients.push({ id: created.id, nom, adresse, telephone: "", email: "", type: "particulier", notes: info });
    } catch (e) {
        // demandé par l'utilisateur: ne pas bloquer la sauvegarde si non lié
        console.warn("Liaison client non créée:", e);
    }
    return clientId;
}

// SAUVEGARDE
window.sauvegarderDocument = async function() { 
    const lignes = []; 
    document.querySelectorAll('#tbody_lignes tr').forEach(tr => { 
        if(tr.classList.contains('row-section')) lignes.push({ type: 'section', text: tr.querySelector('input').value }); 
        else lignes.push({ type: 'item', desc: tr.querySelector('.val-desc').value, cat: tr.querySelector('.val-type').value, prix: parseFloat(tr.querySelector('.val-prix').value)||0 }); 
    }); 

    const docType = document.getElementById('doc_type').value;
    const docDate = document.getElementById('doc_date').value;
    const totalValue = parseFloat(document.getElementById('total_display').innerText);
    const lettrage = summarizePaiements(paiements, totalValue);
    const totalPayeCalc = lettrage.totalPaye;
    const resteCalc = lettrage.reste;
    const existingStatut = String(currentDocSnapshot?.statut || "").trim().toUpperCase();
    let statut = existingStatut || (docType === 'FACTURE' ? 'EMIS' : 'BROUILLON');
    if (statut !== 'ANNULE' && statut !== 'AVOIR') {
        if (docType === 'FACTURE') {
            if (totalPayeCalc <= 0) statut = 'EMIS';
            else if (resteCalc > 0.01) statut = 'PARTIEL';
            else statut = 'PAYE';
        }
    }

    // Émission / échéance (sans relances)
    let dateEmission = currentDocSnapshot?.date_emission || "";
    if (!dateEmission && docType === 'FACTURE') dateEmission = docDate || new Date().toISOString().split('T')[0];
    let dateEcheance = (document.getElementById('doc_echeance') ? document.getElementById('doc_echeance').value : "") || (currentDocSnapshot?.date_echeance || "");
    if (!dateEcheance && docType === 'FACTURE' && dateEmission) {
        try {
            const base = new Date(dateEmission);
            base.setDate(base.getDate() + 30);
            dateEcheance = base.toISOString().split('T')[0];
        } catch(e) {}
    }

    const docData = { 
        type: docType, numero: document.getElementById('doc_numero').value, date: docDate, 
        client_id: document.getElementById('client_id') ? document.getElementById('client_id').value : "",
        client_nom: document.getElementById('client_nom').value, client_adresse: document.getElementById('client_adresse').value, client_civility: document.getElementById('client_civility').value,
        client_info: document.getElementById('client_info') ? document.getElementById('client_info').value : "",
        dossier_numero: document.getElementById('dossier_numero') ? document.getElementById('dossier_numero').value : "",
        dossier_id: document.getElementById('dossier_id') ? document.getElementById('dossier_id').value : "",
        defunt_nom: document.getElementById('defunt_nom').value, defunt_date_naiss: document.getElementById('defunt_date_naiss').value, defunt_date_deces: document.getElementById('defunt_date_deces').value,
        statut,
        date_emission: dateEmission,
        date_echeance: dateEcheance,
        date_dernier_paiement: lettrage.lastDate === "-" ? "" : lettrage.lastDate,
        mode_paiement_principal: lettrage.mainMode === "-" ? "" : lettrage.mainMode,
        total: totalValue, total_paye: totalPayeCalc, reste_a_payer: resteCalc,
        lignes: lignes, paiements: paiements, date_creation: new Date().toISOString(),
        statut_doc: document.getElementById('doc_type').value === 'DEVIS' ? 'En cours' : 'Validé'
    }; 
    const id = document.getElementById('current_doc_id').value; 
    try { 
        docData.client_id = await ensureClientLinkOnSave();

        if (!docData.numero || docData.numero === "Auto") {
            const q = query(collection(db, "factures_v2")); 
            const snap = await getDocs(q); 
            let compteurType = 0;
            snap.forEach(d => { 
                const dType = d.data().type || d.data().info?.type;
                if(dType === docData.type) compteurType++; 
            });
            const prefix = docData.type === 'DEVIS' ? 'D' : 'F';
            docData.numero = `${prefix}-${currentYear}-${String(compteurType + 1).padStart(3, '0')}`;
        }

        // Anti-doublon métier sur le numéro
        const dupSnap = await getDocs(query(collection(db, "factures_v2"), where("numero", "==", docData.numero)));
        if (!dupSnap.empty) {
            const hasOther = dupSnap.docs.some(x => !id || x.id !== id);
            if (hasOther) {
                alert(`Numéro déjà utilisé : ${docData.numero}. Choisissez un autre numéro.`);
                return;
            }
        }

        if(id) {
            await updateDoc(doc(db, "factures_v2", id), docData); 
        } 
        else { 
            await addDoc(collection(db, "factures_v2"), docData); 
        } 
        alert("✅ Enregistré !"); window.showDashboard(); 
    } catch(e) { alert("Erreur : " + e.message); } 
};

window.ajouterPaiement = async () => {
    const date = document.getElementById('pay_date').value;
    const mode = document.getElementById('pay_mode').value;
    const montant = parseFloat(document.getElementById('pay_amount').value);
    const fileInput = document.getElementById('pay_receipt');
    const file = fileInput?.files?.[0];
    if (!(montant > 0)) return;
    try {
        const numeroDoc = document.getElementById('doc_numero')?.value || "DOC";
        const receipt = await uploadPaymentReceipt(file, numeroDoc);
        const p = {
            date,
            mode,
            montant,
            justificatif_url: receipt.url || "",
            justificatif_path: receipt.path || "",
            justificatif_nom: file?.name || ""
        };
        paiements.push(p);
        if (fileInput) fileInput.value = "";
        window.renderPaiements();
        window.calculTotal();
    } catch (e) {
        alert("Erreur justificatif : " + (e?.message || e));
    }
};
window.supprimerPaiement = (i) => { paiements.splice(i, 1); window.renderPaiements(); window.calculTotal(); };
window.renderPaiements = () => { const div = document.getElementById('liste_paiements'); div.innerHTML = ""; paiements.forEach((p, i) => { const receipt = p.justificatif_url ? ` <a href="${p.justificatif_url}" target="_blank" rel="noopener" style="margin-left:8px; color:#065f46; font-weight:700;">Justificatif</a>` : ""; div.innerHTML += `<div>${p.date} - ${p.mode}: <strong>${p.montant}€</strong>${receipt} <i class="fas fa-trash" style="color:red;cursor:pointer;margin-left:10px;" onclick="window.supprimerPaiement(${i})"></i></div>`; }); };
window.supprimerDocument = async (id) => { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"factures_v2",id)); window.chargerListeFactures(); } };
window.transformerEnFacture = async function() { if(confirm("Créer une FACTURE à partir de ce devis ?")) { 
    const idDevis = document.getElementById('current_doc_id').value;
    if(idDevis) { try { await updateDoc(doc(db, "factures_v2", idDevis), { statut_doc: 'Validé' }); } catch(e) { console.log(e); } }
    document.getElementById('doc_type').value = "FACTURE"; document.getElementById('doc_date').valueAsDate = new Date(); document.getElementById('current_doc_id').value = ""; document.getElementById('doc_numero').value = "Auto"; window.sauvegarderDocument(); 
} };

window.annulerDocumentById = async function(id) {
    if(!confirm("Annuler ce document ? (Il ne sera pas supprimé)")) return;
    try {
        await updateDoc(doc(db, "factures_v2", id), {
            statut: "ANNULE",
            date_annulation: new Date().toISOString().split('T')[0]
        });
        window.chargerListeFactures(true);
    } catch(e) { alert("Erreur : " + e.message); }
};

window.annulerDocument = async function() {
    const id = document.getElementById('current_doc_id')?.value;
    if(!id) return alert("Aucun document ouvert.");
    await window.annulerDocumentById(id);
    try { window.showDashboard(); } catch(_) {}
};

// EXPORT EXCEL
window.exportExcelSmart = function() { 
    let csvContent = "data:text/csv;charset=utf-8,"; 
    if(!document.getElementById('tab-factures').classList.contains('hidden')) { 
        csvContent += "Numero;Date;Type;Statut;Dossier;Client;Defunt;Total TTC;Total Paye;Reste a Payer;Dernier Paiement;Mode Principal\n"; 
        cacheFactures.forEach(d => { 
            const lt = summarizePaiements(d.finalPaiements || [], d.finalTotal || 0);
            csvContent += `${d.finalNumero};${d.finalDate};${d.finalType};${d.finalStatut || ''};${d.finalDossierNumero || ''};${d.finalClient};${d.finalDefunt};${(d.finalTotal || 0).toFixed(2)};${lt.totalPaye.toFixed(2)};${lt.reste.toFixed(2)};${lt.lastDate};${lt.mainMode}\n`; 
        }); 
        const encodedUri = encodeURI(csvContent); 
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "export_ventes.csv"); 
        document.body.appendChild(link); link.click(); 
    } 
    else { 
        csvContent += "Date;Fournisseur;Reference;Categorie;Montant;Statut\n"; 
        cacheDepenses.forEach(d => { 
            csvContent += `${d.date};${d.fournisseur};${d.reference};${d.categorie};${d.montant};${d.statut}\n`; 
        }); 
        const encodedUri = encodeURI(csvContent); 
        const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "export_achats.csv"); 
        document.body.appendChild(link); link.click(); 
    } 
};

function guessDossierNumero(data, id) {
    return data?.numero_dossier
        || data?.technique?.numero_dossier
        || data?.details_op?.numero_dossier
        || data?.details_op?.numero
        || data?.reference
        || id
        || "";
}

function applyDossierToForm(dossier) {
    if (!dossier) return;
    const dossierIdEl = document.getElementById('dossier_id');
    const dossierNumeroEl = document.getElementById('dossier_numero');
    if (dossierIdEl) dossierIdEl.value = dossier.id || "";
    if (dossierNumeroEl) dossierNumeroEl.value = dossier.numero || "";
    const addr = dossier?.data?.mandant?.adresse || "";
    if (addr && document.getElementById('client_adresse')) document.getElementById('client_adresse').value = addr;
}

function applyClientToForm(clientDoc) {
    if (!clientDoc) return;
    const idEl = document.getElementById('client_id');
    const nomEl = document.getElementById('client_nom');
    const adrEl = document.getElementById('client_adresse');
    const infoEl = document.getElementById('client_info');
    if (idEl) idEl.value = clientDoc.id || "";
    if (nomEl && !nomEl.value) nomEl.value = clientDoc.nom || "";
    if (adrEl && !adrEl.value) adrEl.value = clientDoc.adresse || "";
    if (infoEl && !infoEl.value) infoEl.value = clientDoc.telephone || clientDoc.notes || "";
}

function findClientByName(name) {
    const n = normalizeText(name);
    if (!n) return null;
    return cacheClients.find(c => normalizeText(c.nom) === n) || null;
}

function findDossierByNamesForMigration(clientName, defuntName) {
    const c = normalizeText(clientName);
    const d = normalizeText(defuntName);
    if (c) {
        const byClient = cacheDossiersAdmin.find(x => normalizeText(x?.data?.mandant?.nom) === c);
        if (byClient) return byClient;
    }
    if (d) {
        const byDefunt = cacheDossiersAdmin.find(x => normalizeText(x?.data?.defunt?.nom) === d);
        if (byDefunt) return byDefunt;
    }
    return null;
}

async function renderClientHistoryInSheet(clientId, fallbackName = "") {
    const tbody = document.getElementById('sheet_client_history');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Chargement...</td></tr>';
    let rows = [];
    try {
        if (clientId) {
            const snap = await getDocs(query(collection(db, "factures_v2"), where("client_id", "==", clientId), limit(80)));
            snap.forEach(d => {
                const x = d.data();
                rows.push({
                    numero: x.numero || x.info?.numero || "-",
                    date: x.date || x.info?.date || x.date_creation || "",
                    type: x.type || x.info?.type || "DOC",
                    statut: x.statut || computeFactureStatut(x),
                    total: parseFloat((x.total !== undefined) ? x.total : (x.info?.total || 0))
                });
            });
        } else if (fallbackName) {
            rows = cacheFactures
                .filter(f => normalizeText(f.finalClient) === normalizeText(fallbackName))
                .map(f => ({
                    numero: f.finalNumero || "-",
                    date: f.finalDate || "",
                    type: f.finalType || "DOC",
                    statut: f.finalStatut || "-",
                    total: parseFloat(f.finalTotal || 0)
                }));
        }
    } catch (_) {}

    rows.sort((a, b) => (String(b.date || "")).localeCompare(String(a.date || "")));
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Aucune facture liée.</td></tr>';
        return;
    }
    tbody.innerHTML = "";
    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(r.numero)}</td>
            <td>${escapeHtml(formatDateFR(r.date))}</td>
            <td>${escapeHtml(r.type)}</td>
            <td>${escapeHtml(String(r.statut || "").toUpperCase())}</td>
            <td style="text-align:right;">${(parseFloat(r.total) || 0).toFixed(2)} €</td>
        `;
        tbody.appendChild(tr);
    });
}

window.closeClientSheet = function() {
    document.getElementById('modal-client-sheet')?.classList.add('hidden');
};

window.openClientSheet = async function() {
    const nom = document.getElementById('client_nom')?.value || "";
    if (!nom) return alert("Renseigne d'abord le nom du client.");

    // On essaie de lier automatiquement avant ouverture (non bloquant)
    const linkedId = await ensureClientLinkOnSave();
    const clientId = linkedId || document.getElementById('client_id')?.value || "";
    let client = clientId ? cacheClients.find(c => c.id === clientId) : findClientByName(nom);

    if (!client && clientId) {
        try {
            const snap = await getDoc(doc(db, "clients", clientId));
            if (snap.exists()) client = { id: snap.id, ...(snap.data() || {}) };
        } catch (_) {}
    }

    const id = client?.id || clientId || "";
    document.getElementById('sheet_client_id').value = id;
    document.getElementById('sheet_client_nom').value = client?.nom || nom || "";
    document.getElementById('sheet_client_type').value = client?.type || "particulier";
    document.getElementById('sheet_client_tel').value = client?.telephone || "";
    document.getElementById('sheet_client_email').value = client?.email || "";
    document.getElementById('sheet_client_adresse').value = client?.adresse || document.getElementById('client_adresse')?.value || "";
    document.getElementById('sheet_client_notes').value = client?.notes || document.getElementById('client_info')?.value || "";

    document.getElementById('modal-client-sheet')?.classList.remove('hidden');
    await renderClientHistoryInSheet(id, nom);
};

window.saveClientSheet = async function() {
    const idEl = document.getElementById('sheet_client_id');
    const data = {
        nom: document.getElementById('sheet_client_nom')?.value || "",
        type: document.getElementById('sheet_client_type')?.value || "particulier",
        telephone: document.getElementById('sheet_client_tel')?.value || "",
        email: document.getElementById('sheet_client_email')?.value || "",
        adresse: document.getElementById('sheet_client_adresse')?.value || "",
        notes: document.getElementById('sheet_client_notes')?.value || "",
        updated_at: new Date().toISOString()
    };
    if (!data.nom) return alert("Nom client obligatoire.");
    try {
        let clientId = idEl?.value || "";
        if (clientId) {
            await updateDoc(doc(db, "clients", clientId), data);
        } else {
            const created = await addDoc(collection(db, "clients"), {
                ...data,
                created_at: new Date().toISOString()
            });
            clientId = created.id;
            if (idEl) idEl.value = clientId;
            if (document.getElementById('client_id')) document.getElementById('client_id').value = clientId;
        }

        // Répercute dans le formulaire facture
        if (document.getElementById('client_nom')) document.getElementById('client_nom').value = data.nom;
        if (document.getElementById('client_adresse')) document.getElementById('client_adresse').value = data.adresse;
        if (document.getElementById('client_info')) document.getElementById('client_info').value = data.telephone || data.notes || "";
        if (document.getElementById('client_id')) document.getElementById('client_id').value = clientId;

        // rafraîchit cache clients local
        const idx = cacheClients.findIndex(c => c.id === clientId);
        const fresh = { id: clientId, ...data };
        if (idx >= 0) cacheClients[idx] = fresh;
        else cacheClients.push(fresh);

        await renderClientHistoryInSheet(clientId, data.nom);
        alert("✅ Fiche client enregistrée.");
    } catch (e) {
        alert("Erreur fiche client : " + (e?.message || e));
    }
};

window.runMigrationDouce = async function() {
    const ok = confirm("Lancer la migration douce des anciennes factures ?\n\nCette action enrichit les champs manquants (client_id, dossier, lettrage, échéance/statut) sans casser l'historique.");
    if (!ok) return;

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const startTs = Date.now();

    try {
        // Précharge caches utiles
        await chargerSuggestionsClients();

        // Recharge référentiel clients (au cas où)
        try {
            cacheClients = [];
            const cSnap = await getDocs(query(collection(db, "clients"), orderBy("nom")));
            cSnap.forEach(x => cacheClients.push({ id: x.id, ...(x.data() || {}) }));
        } catch (_) {}

        let lastDoc = null;
        while (true) {
            let q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(100));
            if (lastDoc) q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), startAfter(lastDoc), limit(100));
            const snap = await getDocs(q);
            if (snap.empty) break;

            for (const docSnap of snap.docs) {
                scanned += 1;
                const data = docSnap.data() || {};
                const patch = {};

                const type = data.type || data.info?.type || "DOC";
                const clientNom = data.client_nom || data.client?.nom || "";
                const defuntNom = data.defunt_nom || data.defunt?.nom || "";
                const total = parseFloat((data.total !== undefined) ? data.total : (data.info?.total || 0)) || 0;
                const paiements = Array.isArray(data.paiements) ? data.paiements : [];
                const lettrage = summarizePaiements(paiements, total);

                // client_id manquant -> liaison/creation douce
                if (!data.client_id && clientNom) {
                    let found = findClientByName(clientNom);
                    if (!found) {
                        try {
                            const created = await addDoc(collection(db, "clients"), {
                                nom: clientNom,
                                adresse: data.client_adresse || data.client?.adresse || "",
                                telephone: "",
                                email: "",
                                type: "particulier",
                                notes: data.client_info || "",
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });
                            found = { id: created.id, nom: clientNom };
                            cacheClients.push(found);
                        } catch (_) {}
                    }
                    if (found?.id) patch.client_id = found.id;
                }

                // dossier_id / dossier_numero manquants
                if (!data.dossier_id || !data.dossier_numero) {
                    const dossier = findDossierByNamesForMigration(clientNom, defuntNom);
                    if (dossier) {
                        if (!data.dossier_id) patch.dossier_id = dossier.id;
                        if (!data.dossier_numero) patch.dossier_numero = dossier.numero || dossier.id;
                    }
                }

                // Lettrage manquant
                if (data.total_paye === undefined) patch.total_paye = lettrage.totalPaye;
                if (data.reste_a_payer === undefined) patch.reste_a_payer = lettrage.reste;
                if (!data.date_dernier_paiement && lettrage.lastDate !== "-") patch.date_dernier_paiement = lettrage.lastDate;
                if (!data.mode_paiement_principal && lettrage.mainMode !== "-") patch.mode_paiement_principal = lettrage.mainMode;

                // Statut / dates facture manquants
                if (!data.statut) {
                    patch.statut = computeFactureStatut({
                        ...data,
                        finalType: type,
                        finalTotal: total,
                        finalPaiements: paiements
                    });
                }
                if (type === "FACTURE") {
                    if (!data.date_emission) {
                        const d = (data.date || data.info?.date || data.date_creation || "").toString();
                        patch.date_emission = d.includes("T") ? d.split("T")[0] : d;
                    }
                    if (!data.date_echeance) {
                        const baseStr = patch.date_emission || data.date_emission || data.date || data.info?.date || "";
                        if (baseStr) {
                            try {
                                const dt = new Date(baseStr);
                                dt.setDate(dt.getDate() + 30);
                                patch.date_echeance = dt.toISOString().split("T")[0];
                            } catch (_) {}
                        }
                    }
                }

                if (Object.keys(patch).length) {
                    try {
                        await updateDoc(doc(db, "factures_v2", docSnap.id), patch);
                        updated += 1;
                    } catch (_) {
                        errors += 1;
                    }
                } else {
                    skipped += 1;
                }
            }

            lastDoc = snap.docs[snap.docs.length - 1];
            if (!lastDoc) break;
        }

        await window.chargerListeFactures(true);
        const elapsed = Math.round((Date.now() - startTs) / 1000);
        alert(`Migration terminée.\n\nScannés: ${scanned}\nMis à jour: ${updated}\nSans changement: ${skipped}\nErreurs: ${errors}\nDurée: ${elapsed}s`);
    } catch (e) {
        alert("Erreur migration: " + (e?.message || e));
    }
};

function findDossierByClientName(name) {
    const n = String(name || "").trim().toLowerCase();
    if (!n) return null;
    const matches = cacheDossiersAdmin.filter(d => String(d?.data?.mandant?.nom || "").trim().toLowerCase() === n);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    return chooseDossierFromMatches(matches, "client");
}

function findDossierByDefuntName(name) {
    const n = String(name || "").trim().toLowerCase();
    if (!n) return null;
    const matches = cacheDossiersAdmin.filter(d => String(d?.data?.defunt?.nom || "").trim().toLowerCase() === n);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    return chooseDossierFromMatches(matches, "defunt");
}

function chooseDossierFromMatches(matches, contextLabel) {
    const title = contextLabel === "defunt"
        ? "Plusieurs dossiers trouvés pour ce défunt."
        : "Plusieurs dossiers trouvés pour ce client.";
    const lines = matches.slice(0, 8).map((d, i) => {
        const date = d?.data?.date_creation ? new Date(d.data.date_creation).toLocaleDateString('fr-FR') : "-";
        const dossierNum = d?.numero || d?.id || "-";
        const mandant = d?.data?.mandant?.nom || "-";
        const defunt = d?.data?.defunt?.nom || "-";
        return `${i + 1}) ${dossierNum} | ${date} | Mandant: ${mandant} | Défunt: ${defunt}`;
    });
    const answer = window.prompt(`${title}\nChoisis un numéro:\n\n${lines.join("\n")}\n\n(Annuler = aucun choix)`, "1");
    if (!answer) return null;
    const idx = parseInt(answer, 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= Math.min(matches.length, 8)) return null;
    return matches[idx];
}

async function chargerSuggestionsClients() {
    try {
        cacheClients = [];
        const names = new Set();
        const dlClients = document.getElementById('clients_suggestions');
        const dlDefunts = document.getElementById('defunts_suggestions');
        if (dlClients) dlClients.innerHTML = "";
        if (dlDefunts) dlDefunts.innerHTML = "";

        // 1) Référentiel clients (si présent)
        try {
            const cSnap = await getDocs(query(collection(db, "clients"), orderBy("nom")));
            cSnap.forEach(docSnap => {
                const data = docSnap.data();
                const item = {
                    id: docSnap.id,
                    nom: data?.nom || "",
                    adresse: data?.adresse || "",
                    telephone: data?.telephone || "",
                    email: data?.email || "",
                    type: data?.type || "particulier",
                    notes: data?.notes || ""
                };
                cacheClients.push(item);
                if (item.nom) names.add(item.nom);
            });
        } catch (_) {
            // collection clients pas encore déployée ou non accessible: on continue en fallback dossiers_admin
        }

        // 2) Fallback dossiers_admin
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"));
        const snap = await getDocs(q);
        cacheDossiersAdmin = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const item = {
                id: docSnap.id,
                numero: guessDossierNumero(data, docSnap.id),
                data
            };
            cacheDossiersAdmin.push(item);

            const mandantNom = data?.mandant?.nom;
            const defuntNom = data?.defunt?.nom;
            if (mandantNom) names.add(mandantNom);
            if (defuntNom && dlDefunts) dlDefunts.innerHTML += `<option value="${defuntNom}">`;
        });

        if (dlClients) {
            dlClients.innerHTML = Array.from(names).map(n => `<option value="${n}">`).join("");
        }
    } catch(e) {}
}

window.checkClientAuto = function() {
    const val = document.getElementById('client_nom')?.value || "";
    const foundClient = findClientByName(val);
    if (foundClient) applyClientToForm(foundClient);
    const dossier = findDossierByClientName(val);
    if (dossier) applyDossierToForm(dossier);
    else {
        const client = cacheFactures.find(f => f.finalClient === val);
        if(client) document.getElementById('client_adresse').value = client.client_adresse || client.client?.adresse || '';
    }
};

window.checkDefuntAuto = function() {
    const val = document.getElementById('defunt_nom')?.value || "";
    const dossier = findDossierByDefuntName(val);
    if (dossier) {
        applyDossierToForm(dossier);
        // si client vide, on propose le mandant du dossier
        const clientNomEl = document.getElementById('client_nom');
        if (clientNomEl && !clientNomEl.value) {
            clientNomEl.value = dossier?.data?.mandant?.nom || "";
            const foundClient = findClientByName(clientNomEl.value);
            if (foundClient) applyClientToForm(foundClient);
        }
    }
};

// GESTION MODÈLES
window.loadTemplate = function(type) { 
    const MODELES = { 
        "Inhumation": [ { type: 'section', text: 'PREPARATION/ORGANISATION DES OBSEQUES' }, { desc: 'Démarches administratives', prix: 250, cat: 'Courant' }, { desc: 'Vacation de Police (Pose de scellés)', prix: 25, cat: 'Courant' }, { type: 'section', text: 'PRÉPARATION DU DÉFUNT' }, { desc: 'Toilette et habillage défunt (e)', prix: 150, cat: 'Courant' }, { desc: 'Séjour en chambre funéraire (Forfait 3 jours)', prix: 350, cat: 'Optionnel' }, { type: 'section', text: 'TRANSPORT AVANT MISE EN BIERE' }, { desc: 'Transport avant mise en bière', prix: 250, cat: 'Courant' }, { type: 'section', text: '3. CERCUEIL & ACCESSOIRES' }, { desc: 'Cercueil Azur inhumation (avec quatre poignées en métal cache vis plastique, et cuvette biodégradable)', prix: 850, cat: 'Courant' }, { desc: 'Capiton (Tissu intérieur)', prix: 80, cat: 'Courant' }, { desc: 'Plaque d\'identité gravée (Obligatoire)', prix: 25, cat: 'Courant' }, { desc: 'Emblème religieux / Civil', prix: 40, cat: 'Optionnel' }, { type: 'section', text: '4. CÉRÉMONIE & CONVOI' }, { desc: 'Corbillard de cérémonie avec chauffeur', prix: 400, cat: 'Courant' }, { desc: 'Porteurs (Equipe de 4 personnes)', prix: 600, cat: 'Courant' }, { desc: 'Maître de cérémonie (Organisation & Gestion)', prix: 200, cat: 'Optionnel' }, { desc: 'Frais de culte', prix: 220, cat: 'Optionnel' }, { desc: 'Registre de condoléances', prix: 35, cat: 'Optionnel' }, { type: 'section', text: '5. CIMETIÈRE' }, { desc: 'Creusement et comblement de fosse / Ouverture de caveau', prix: 650, cat: 'Courant' }, { desc: 'Redevance inhumation (Taxe Mairie)', prix: 50, cat: 'Courant' }, { desc: 'Achat de concession', prix: 50, cat: 'Courant' } ],
        "Cremation": [ { type: 'section', text: 'PREPARATION/ORGANISATION DES OBSEQUES' }, { desc: 'Démarches administratives', prix: 250, cat: 'Courant' }, { desc: 'Vacation de Police (Pose de scellés)', prix: 25, cat: 'Courant' }, { type: 'section', text: 'PRÉPARATION DU DÉFUNT' }, { desc: 'Toilette et habillage défunt (e)', prix: 150, cat: 'Courant' }, { desc: 'Séjour en chambre funéraire (Forfait 3 jours)', prix: 350, cat: 'Optionnel' }, { type: 'section', text: 'TRANSPORT AVANT MISE EN BIERE' }, { desc: 'Transport avant mise en bière', prix: 250, cat: 'Courant' }, { type: 'section', text: '3. CERCUEIL & ACCESSOIRES' }, { desc: 'Cercueil Azur inhumation (avec quatre poignées en métal cache vis plastique, et cuvette biodégradable)', prix: 850, cat: 'Courant' }, { desc: 'Capiton (Tissu intérieur)', prix: 80, cat: 'Courant' }, { desc: 'Plaque d\'identité gravée (Obligatoire)', prix: 25, cat: 'Courant' }, { desc: 'Emblème religieux / Civil', prix: 40, cat: 'Optionnel' }, { type: 'section', text: '4. CÉRÉMONIE & CONVOI' }, { desc: 'Corbillard de cérémonie avec chauffeur', prix: 400, cat: 'Courant' }, { desc: 'Porteurs (Equipe de 4 personnes)', prix: 600, cat: 'Courant' }, { desc: 'Maître de cérémonie (Organisation & Gestion)', prix: 200, cat: 'Optionnel' }, { desc: 'Frais de culte', prix: 220, cat: 'Optionnel' }, { desc: 'Registre de condoléances', prix: 35, cat: 'Optionnel' }, { type: 'section', text: '4. CRÉMATORIUM' }, { desc: 'Frais de Crémation ', prix: 750, cat: 'Courant' }, { desc: 'Urne', prix: 60, cat: 'Courant' } ],
        "Rapatriement": [ { type: 'section', text: 'PREPARATION/ORGANISATION DES OBSEQUES' }, { desc: 'Démarches administratives', prix: 250, cat: 'Courant' }, { desc: 'Vacation de Police (Pose de scellés)', prix: 25, cat: 'Courant' }, { type: 'section', text: 'PRÉPARATION DU DÉFUNT' }, { desc: 'Toilette et habillage défunt (e)', prix: 150, cat: 'Courant' }, { desc: 'Séjour en chambre funéraire (Forfait 3 jours)', prix: 350, cat: 'Optionnel' }, { type: 'section', text: 'TRANSPORT AVANT MISE EN BIERE' }, { desc: 'Transport avant mise en bière', prix: 250, cat: 'Courant' }, { type: 'section', text: '3. CERCUEIL & ACCESSOIRES' }, { desc: 'Cercueil Azur Rapatriement (avec quatre poignées en métal cache vis plastique,Filtre épurateur (Norme IATA) et cuvette biodégradable)', prix: 850, cat: 'Courant' }, { desc: 'Capiton (Tissu intérieur)', prix: 80, cat: 'Courant' }, { desc: 'Plaque d\'identité gravée (Obligatoire)', prix: 25, cat: 'Courant' }, { desc: 'Emblème religieux / Civil', prix: 40, cat: 'Optionnel' }, { type: 'section', text: '4. CÉRÉMONIE & CONVOI' }, { desc: 'Corbillard de cérémonie avec chauffeur', prix: 400, cat: 'Courant' }, { desc: 'Porteurs (Equipe de 4 personnes)', prix: 600, cat: 'Courant' }, { desc: 'Maître de cérémonie (Organisation & Gestion)', prix: 200, cat: 'Optionnel' }, { desc: 'Frais de culte', prix: 220, cat: 'Optionnel' }, { desc: 'Registre de condoléances', prix: 35, cat: 'Optionnel' }, { type: 'section', text: '4. TRANSPORT' }, { desc: 'Transport vers Aéroport (France)', prix: 350, cat: 'Courant' }, { desc: 'Fret Aérien ', prix: 1800, cat: 'Courant' } ],
        "Transport": [ { type: 'section', text: '1. TRANSPORT DE CORPS' }, { desc: 'Véhicule Agréé avec Caisson', prix: 300, cat: 'Courant' }, { desc: 'Chauffeur / Porteur', prix: 150, cat: 'Courant' }, { desc: 'Housse mortuaire impérméable', prix: 45, cat: 'Courant' }, { desc: 'Frais kilométriques (Au-delà du forfait)', prix: 0, cat: 'Courant' } ],
        "Exhumation": [ { type: 'section', text: '1. TECHNIQUE' }, { desc: 'Démarches Mairie & Cimetière', prix: 150, cat: 'Courant' }, { desc: 'Ouverture de monument / Fosse', prix: 600, cat: 'Courant' }, { desc: 'Exhumation du corps', prix: 450, cat: 'Courant' }, { desc: 'Fourniture Reliquaire (Boîte à ossements)', prix: 120, cat: 'Courant' }, { desc: 'Réduction de corps', prix: 200, cat: 'Optionnel' }, { desc: 'Fermeture de sépulture', prix: 200, cat: 'Courant' }, { desc: 'Vacation de Police', prix: 25, cat: 'Courant' } ],
        "Devis": [ { type: 'section', text: 'PRESTATIONS' }, { desc: 'Frais de dossier et démarches', prix: 150, cat: 'Courant' }, { desc: 'Véhicule avec chauffeur', prix: 300, cat: 'Courant' }, { desc: 'Personnel (Porteurs)', prix: 450, cat: 'Courant' }, { type: 'section', text: 'FOURNITURES' }, { desc: 'Cercueil', prix: 850, cat: 'Courant' }, { desc: 'Plaque d\'identité', prix: 25, cat: 'Courant' }, { desc: 'Urne / Accessoire', prix: 0, cat: 'Optionnel' } ]
    }; 
    document.getElementById('modal-choix').classList.add('hidden'); 
    window.nouveauDocument(); 
    if (MODELES[type]) { 
        document.getElementById('tbody_lignes').innerHTML = ""; 
        MODELES[type].forEach(item => { if(item.type === 'section') window.ajouterSection(item.text); else window.ajouterLigne(item.desc, item.prix, item.cat); }); 
    } 
    window.calculTotal(); 
};

// IMPRESSION PDF (LAYOUT OPTIMISÉ)
window.genererPDFFacture = function() {
    const data = {
        client: { nom: document.getElementById('client_nom').value, adresse: document.getElementById('client_adresse').value, info: document.getElementById('client_info') ? document.getElementById('client_info').value : "", civility: document.getElementById('client_civility').value },
        defunt: { nom: document.getElementById('defunt_nom').value, naiss: document.getElementById('defunt_date_naiss').value, deces: document.getElementById('defunt_date_deces').value },
        info: { type: document.getElementById('doc_type').value, date: document.getElementById('doc_date').value, numero: document.getElementById('doc_numero').value, total: parseFloat(document.getElementById('total_display').innerText) },
        lignes: [], paiements: paiements
    };
    document.querySelectorAll('#tbody_lignes tr').forEach(tr => {
        if(tr.classList.contains('row-section')) { data.lignes.push({ type: 'section', text: tr.querySelector('input').value }); } 
        else { data.lignes.push({ type: 'item', desc: tr.querySelector('.val-desc').value, cat: tr.querySelector('.val-type').value, prix: parseFloat(tr.querySelector('.val-prix').value)||0 }); }
    });
    window.generatePDFFromData(data, false);
};

window.generatePDFFromData = function(data, saveMode = false) {
    if(!logoBase64) chargerLogoBase64();
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF();
    const greenColor = [16, 185, 129]; 
    if (logoBase64) { try { doc.addImage(logoBase64,'PNG', 15, 10, 25, 25); } catch(e){} }
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...greenColor);
    doc.text("PF SOLIDAIRE", 15, 40);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(80);
    doc.text("32 boulevard Léon Jean Grégory Thuir - TEL : 07.55.18.27.77", 15, 45);
    doc.text("HABILITATION N° : 23-66-0205 | SIRET : 53927029800042", 15, 49);
    doc.setFillColor(245, 245, 245); doc.roundedRect(110, 10, 85, 32, 3, 3, 'F');
    doc.setFontSize(10); doc.setTextColor(0); doc.setFont("helvetica","bold");
    doc.text(`${data.client.civility || ''} ${data.client.nom}`, 115, 18);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); 
    const addrLines = doc.splitTextToSize(data.client.adresse || '', 80);
    doc.text(addrLines, 115, 24);
    const infoText = String(data.client.info || "").trim();
    if (infoText) {
        const infoY = 24 + (addrLines.length * 4) + 2;
        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(doc.splitTextToSize(infoText, 80), 115, infoY);
        doc.setTextColor(0);
    }
    let y = 58; doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(...greenColor);
    doc.text(`${data.info.type} N° ${data.info.numero}`, 15, y);
    doc.setFontSize(10); doc.setTextColor(0); doc.setFont("helvetica","normal");
    doc.text(`Date : ${new Date(data.info.date).toLocaleDateString()}`, 15, y+6);
    doc.text(`Défunt : ${data.defunt.nom}`, 15, y+12);
    let datesDefunt = ""; if(data.defunt.naiss) datesDefunt += `Né(e) le : ${new Date(data.defunt.naiss).toLocaleDateString()} `; if(data.defunt.deces) datesDefunt += `- Décédé(e) le : ${new Date(data.defunt.deces).toLocaleDateString()}`; doc.setFontSize(8); doc.setTextColor(100); doc.text(datesDefunt, 15, y+16);
    y += 22;
    const body = [];
    data.lignes.forEach(l => {
        if(l.type === 'section') { 
            body.push([{ content: l.text, colSpan: 3, styles: { fillColor: [255, 237, 213], textColor:[154, 52, 18], fontStyle: 'bold', halign:'left' } }]); 
        } 
        else { 
            let pCourant = "", pOptionnel = "";
            const prixFmt = parseFloat(l.prix).toFixed(2) + ' €';
            if (l.cat === 'Optionnel') pOptionnel = prixFmt; else pCourant = prixFmt; 
            body.push([l.desc, pCourant, pOptionnel]);
        }
    });
    doc.autoTable({
        startY: y,
        margin: { left: 12, right: 12 },
        head: [['Description', 'Prestations\nCourantes (TTC)', 'Prestations\nOptionnelles (TTC)']],
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [16, 185, 129], textColor: 255, halign: 'center', valign: 'middle', fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'right', cellWidth: 33 }, 2: { halign: 'right', cellWidth: 33 } }
    });
    
    // --- TOTAUX & PIED DE PAGE OPTIMISÉ ---
    let footerY = doc.lastAutoTable.finalY + 8;
    if (footerY > 250) { doc.addPage(); footerY = 20; }

    const rightLabelX = 165; const rightValueX = 195;
    const totalTTC = data.info.total;
    const totalPaye = data.paiements.reduce((sum, p) => sum + parseFloat(p.montant), 0);
    const resteAPayer = totalTTC - totalPaye;

    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    doc.text(`Total TTC :`, rightLabelX, footerY, { align: 'right' }); 
    doc.setFont("helvetica", "bold"); 
    doc.text(`${totalTTC.toFixed(2)} €`, rightValueX, footerY, { align: 'right' });
    footerY += 6;

    if (totalPaye > 0) { 
        doc.setFont("helvetica", "normal"); 
        doc.text(`Déjà réglé :`, rightLabelX, footerY, { align: 'right' }); 
        doc.text(`- ${totalPaye.toFixed(2)} €`, rightValueX, footerY, { align: 'right' }); 
        footerY += 6; 
    }
    
    doc.setLineWidth(0.5); doc.line(120, footerY, 195, footerY); footerY += 6;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); 
    doc.text(`Net à Payer :`, rightLabelX, footerY, { align: 'right' }); 
    doc.text(`${resteAPayer.toFixed(2)} €`, rightValueX, footerY, { align: 'right' });

    const leftX = 15;
    let leftY = doc.lastAutoTable.finalY + 10; 
    if (leftY > 250) leftY = 20; 

    if (data.info.type === 'DEVIS') {
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("Bon pour accord (Date & Signature) :", leftX, leftY);
        doc.rect(leftX, leftY + 3, 80, 25);
    } else {
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text("RÈGLEMENT :", leftX, leftY);
        doc.setFont("helvetica", "normal");
        doc.text(INFO_SOCIETE.conditions, leftX + 25, leftY);
        leftY += 5;
        doc.setFillColor(248, 250, 252); doc.rect(leftX, leftY, 90, 18, 'F'); doc.setDrawColor(200); doc.rect(leftX, leftY, 90, 18);
        doc.setFont("helvetica", "bold"); doc.text("COORDONNÉES BANCAIRES", leftX + 2, leftY + 4);
        doc.setFont("helvetica", "normal"); doc.text(`Banque : ${INFO_SOCIETE.banque}`, leftX + 2, leftY + 9);
        doc.text(`IBAN : ${INFO_SOCIETE.iban}`, leftX + 2, leftY + 14);
    }

    // Mention légale TVA (franchise en base)
    try {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text("TVA non applicable, art. 293 B du CGI", 15, pageHeight - 10);
    } catch (e) {}

    if(saveMode) doc.save(`${data.info.type}_${data.info.numero}.pdf`); else window.open(doc.output('bloburl'), '_blank');
};
