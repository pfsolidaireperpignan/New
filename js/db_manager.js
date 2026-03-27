/* js/db_manager.js - VERSION FINALE (RECHERCHE ACTIVE) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = [];
let dossiersCache = []; // dossiers_admin
let clientsRefCache = []; // collection clients
let selectedClientRef = null;
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function renderClientsRefRows(refBody, rows) {
    if (!refBody) return;
    if (!rows || !rows.length) {
        refBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Aucune fiche client.</td></tr>';
        return;
    }
    refBody.innerHTML = "";
    rows.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${escapeHtml(c.id || '-')}</code></td>
            <td><strong>${escapeHtml(c.nom || '-')}</strong></td>
            <td>${escapeHtml(c.telephone || '-')}</td>
            <td>${escapeHtml(c.email || '-')}</td>
            <td><span class="badge badge-blue">${escapeHtml(c.type || 'particulier')}</span></td>
            <td>${escapeHtml(c.adresse || '-')}</td>
            <td>${escapeHtml(c.notes || '-')}</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.openBaseClientDetails('${escapeHtml(c.id || '')}')" title="Ouvrir détails">
                    <i class="fas fa-eye" style="color:#3b82f6;"></i>
                </button>
            </td>
        `;
        refBody.appendChild(tr);
    });
}

function getClientById(id) {
    return clientsRefCache.find(c => String(c.id) === String(id)) || null;
}

function setClientDetailForm(c) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
    set('detail_client_id', c?.id || "");
    set('detail_client_nom', c?.nom || "");
    set('detail_client_type', c?.type || "particulier");
    set('detail_client_tel', c?.telephone || "");
    set('detail_client_email', c?.email || "");
    set('detail_client_adresse', c?.adresse || "");
    set('detail_client_notes', c?.notes || "");
    const title = document.getElementById('client-detail-title');
    if (title) title.textContent = `Détails Client : ${c?.nom || "-"}`;
}

function formatDateFr(dateStr) {
    try { return dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : "-"; } catch (_) { return String(dateStr || "-"); }
}

function parseTypeDoc(x) {
    return String(x?.type || x?.info?.type || "DOC").toUpperCase();
}

function normalizeStatut(x) {
    const s = String(x || "").trim().toUpperCase();
    if (!s || s === "BROUILLON") return "ÉMIS";
    if (s === "PAYE") return "PAYÉ";
    if (s === "ANNULE") return "ANNULÉ";
    return s;
}

async function renderClientFacturesDevis(clientObj) {
    const tbody = document.getElementById('client-factures-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Chargement...</td></tr>';

    let rows = [];
    try {
        if (clientObj?.id) {
            const snap = await getDocs(query(collection(db, "factures_v2"), where("client_id", "==", clientObj.id), limit(200)));
            snap.forEach(d => rows.push({ id: d.id, ...(d.data() || {}) }));
        }
    } catch (_) {}

    if (!rows.length && clientObj?.nom) {
        try {
            const snap2 = await getDocs(query(collection(db, "factures_v2"), where("client_nom", "==", clientObj.nom), limit(200)));
            snap2.forEach(d => rows.push({ id: d.id, ...(d.data() || {}) }));
        } catch (_) {}
    }

    rows.sort((a, b) => String(b.date || b.date_creation || "").localeCompare(String(a.date || a.date_creation || "")));
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Aucun document lié.</td></tr>';
        return;
    }

    tbody.innerHTML = "";
    rows.forEach(x => {
        const type = parseTypeDoc(x);
        const numero = x.numero || x.info?.numero || "-";
        const date = x.date || x.info?.date || x.date_creation || "";
        const statut = normalizeStatut(x.statut || (type === "FACTURE" ? "EMIS" : "EMIS"));
        const total = parseFloat((x.total !== undefined) ? x.total : (x.info?.total || 0)) || 0;
        const encodedId = encodeURIComponent(String(x.id || ""));
        const canValider = type === "DEVIS" && String(x.statut_doc || "").toLowerCase() !== "validé";
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge ${type === "FACTURE" ? "badge-facture" : "badge-devis"}">${escapeHtml(type)}</span></td>
            <td><strong>${escapeHtml(numero)}</strong></td>
            <td>${escapeHtml(formatDateFr(date))}</td>
            <td>${escapeHtml(statut)}</td>
            <td style="text-align:right;">${total.toFixed(2)} €</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.openClientDocPdf('${encodedId}')" title="Voir PDF"><i class="fas fa-file-pdf"></i></button>
                <button class="btn-icon" onclick="window.openClientDocEditor('${encodedId}')" title="Éditer"><i class="fas fa-pen"></i></button>
                ${canValider
                    ? `<button class="btn-icon" onclick="window.validerClientDoc('${encodedId}')" title="Valider devis"><i class="fas fa-check"></i></button>`
                    : `<button class="btn-icon" style="opacity:0.35; cursor:not-allowed;" title="Validation non applicable"><i class="fas fa-check"></i></button>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

export function openClientDocEditor(encodedDocId) {
    const id = decodeURIComponent(String(encodedDocId || ""));
    if (!id) return;
    window.location.href = `facturation_v2.html?doc=${encodeURIComponent(id)}`;
}

export function openClientDocPdf(encodedDocId) {
    const id = decodeURIComponent(String(encodedDocId || ""));
    if (!id) return;
    const url = `facturation_v2.html?preview=${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener,noreferrer");
}

export async function validerClientDoc(encodedDocId) {
    const id = decodeURIComponent(String(encodedDocId || ""));
    if (!id) return;
    if (!confirm("Valider ce devis ?")) return;
    try {
        await updateDoc(doc(db, "factures_v2", id), { statut_doc: "Validé", updated_at: new Date().toISOString() });
        if (selectedClientRef) await renderClientFacturesDevis(selectedClientRef);
        alert("✅ Devis validé.");
    } catch (e) {
        alert("Erreur validation : " + (e?.message || e));
    }
}

export function showBaseClientListView() {
    document.getElementById('base-client-detail-view')?.classList.add('hidden');
    document.getElementById('base-clients-list-view')?.classList.remove('hidden');
}

export function switchBaseClientDetailTab(tab) {
    const tabs = ['prestations', 'factures', 'journal', 'technique', 'pieces'];
    tabs.forEach(t => {
        document.getElementById(`client-tab-${t}`)?.classList.remove('active');
        document.getElementById(`client-tab-content-${t}`)?.classList.add('hidden');
    });
    document.getElementById(`client-tab-${tab}`)?.classList.add('active');
    document.getElementById(`client-tab-content-${tab}`)?.classList.remove('hidden');
}

export async function openBaseClientDetails(clientId) {
    const c = getClientById(clientId);
    if (!c) return;
    selectedClientRef = c;
    setClientDetailForm(c);
    document.getElementById('base-clients-list-view')?.classList.add('hidden');
    document.getElementById('base-client-detail-view')?.classList.remove('hidden');
    switchBaseClientDetailTab('factures');
    await renderClientFacturesDevis(c);
}

export async function saveBaseClientDetails() {
    const id = document.getElementById('detail_client_id')?.value || "";
    if (!id) return alert("ID client manquant.");
    const data = {
        nom: document.getElementById('detail_client_nom')?.value || "",
        type: document.getElementById('detail_client_type')?.value || "particulier",
        telephone: document.getElementById('detail_client_tel')?.value || "",
        email: document.getElementById('detail_client_email')?.value || "",
        adresse: document.getElementById('detail_client_adresse')?.value || "",
        notes: document.getElementById('detail_client_notes')?.value || "",
        updated_at: new Date().toISOString()
    };
    if (!data.nom) return alert("Nom client obligatoire.");
    try {
        await updateDoc(doc(db, "clients", id), data);
        const idx = clientsRefCache.findIndex(x => String(x.id) === String(id));
        if (idx >= 0) clientsRefCache[idx] = { ...clientsRefCache[idx], ...data };
        selectedClientRef = { ...(selectedClientRef || {}), id, ...data };
        setClientDetailForm(selectedClientRef);
        filtrerBaseClients();
        alert("✅ Modifications client enregistrées.");
    } catch (e) {
        alert("Erreur enregistrement client : " + (e?.message || e));
    }
}

function guessDossierCode(data, id) {
    return data?.technique?.numero_dossier || data?.details_op?.numero_dossier || data?.numero_dossier || id || "-";
}

function renderDossiersAdminRows(tbody, rows) {
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Aucun dossier trouvé.</td></tr>';
        return;
    }
    tbody.innerHTML = "";
    rows.forEach(data => {
        const tr = document.createElement('tr');
        let dateCreation = '-';
        if (data.date_creation) {
            try { dateCreation = new Date(data.date_creation).toLocaleDateString(); } catch (_) {}
        }
        const defuntNomComplet = `${data.defunt?.nom || ''} ${data.defunt?.prenom || ''}`.trim();
        const codeDossier = guessDossierCode(data, data.id);
        tr.innerHTML = `
            <td>${dateCreation}</td>
            <td><strong>${escapeHtml(codeDossier)}</strong></td>
            <td><strong>${escapeHtml(defuntNomComplet || 'Inconnu')}</strong></td>
            <td>${escapeHtml(data.mandant?.nom || '-')}</td>
            <td><span class="badge badge-blue">${escapeHtml(data.technique?.type_operation || 'Dossier')}</span></td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.chargerDossier('${data.id}')" title="Ouvrir le dossier">
                    <i class="fas fa-eye" style="color:#3b82f6;"></i>
                </button>
                <button class="btn-icon" onclick="window.supprimerDossier('${data.id}')" title="Supprimer définitivement">
                    <i class="fas fa-trash" style="color:#ef4444;"></i>
                </button>
            </td>`;
        tbody.appendChild(tr);
    });
}

// --- 1. BASE CLIENTS (fiches clients uniquement) ---
export async function chargerBaseClients() {
    const refBody = document.getElementById('clients-ref-table-body');
    if (!refBody) return;
    refBody.innerHTML = '<tr><td colspan="7" style="text-align:center">Chargement des fiches clients...</td></tr>';
    
    try {
        try {
            const cQ = query(collection(db, "clients"), orderBy("nom"), limit(300));
            const cSnap = await getDocs(cQ);
            clientsRefCache = [];
            cSnap.forEach(docSnap => clientsRefCache.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
            renderClientsRefRows(refBody, clientsRefCache);
        } catch (e) {
            try {
                const fallbackSnap = await getDocs(query(collection(db, "clients"), limit(300)));
                clientsRefCache = [];
                fallbackSnap.forEach(docSnap => clientsRefCache.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
                clientsRefCache.sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), 'fr'));
                renderClientsRefRows(refBody, clientsRefCache);
            } catch (e2) {
                console.error("Erreur chargement collection clients:", e2);
                const msg = (e2?.code || e?.code || "inconnue").toString();
                refBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">Erreur chargement fiches clients (${escapeHtml(msg)}).</td></tr>`;
            }
        }
    } catch (e) { 
        console.error(e); 
        refBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Erreur chargement fiches clients.</td></tr>';
    }
}

export function filtrerBaseClients() {
    const term = (document.getElementById('search-client')?.value || "").toLowerCase();
    const refBody = document.getElementById('clients-ref-table-body');
    if (!refBody) return;
    const resultats = clientsRefCache.filter(c => {
        const txt = `${c.id || ""} ${c.nom || ""} ${c.telephone || ""} ${c.email || ""} ${c.type || ""} ${c.adresse || ""} ${c.notes || ""}`.toLowerCase();
        return txt.includes(term);
    });
    renderClientsRefRows(refBody, resultats);
}

// --- 2. DOSSIERS ADMIN (liste déplacée depuis Base Clients) ---
export async function chargerDossiersAdminList() {
    const tbody = document.getElementById('dossiers-admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Chargement des dossiers...</td></tr>';
    try {
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(200));
        const snapshot = await getDocs(q);
        dossiersCache = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data() || {};
            data.id = docSnap.id;
            dossiersCache.push(data);
        });
        filtrerDossiersAdmin();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erreur chargement dossiers.</td></tr>';
    }
}

export function filtrerDossiersAdmin() {
    const tbody = document.getElementById('dossiers-admin-table-body');
    if (!tbody) return;
    const term = (document.getElementById('search-dossier-admin')?.value || "").toLowerCase();
    const rows = dossiersCache.filter(d => {
        const defunt = `${d.defunt?.nom || ""} ${d.defunt?.prenom || ""}`.trim();
        const mandant = d.mandant?.nom || "";
        const code = guessDossierCode(d, d.id);
        const txt = `${defunt} ${mandant} ${code} ${d.technique?.type_operation || ""}`.toLowerCase();
        return txt.includes(term);
    });
    renderDossiersAdminRows(tbody, rows);
}

// --- 3. IMPORT (FACTURATION -> DOSSIER) ---
export async function chargerSelectImport() {
    const select = document.getElementById('select-import-client');
    if(!select) return;
    select.innerHTML = '<option>Chargement...</option>';
    
    try {
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(20));
        const snaps = await getDocs(q);
        importCache = [];
        select.innerHTML = '<option value="">Choisir un client...</option>';
        
        snaps.forEach(doc => {
            const d = doc.data();
            importCache.push({ id: doc.id, ...d });
            const label = `${d.info?.type || 'DOC'} ${d.info?.numero || ''} - ${d.client?.nom || '?'} (Défunt: ${d.defunt?.nom || '?'})`;
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.innerText = label;
            select.appendChild(opt);
        });
    } catch(e) { console.error(e); select.innerHTML = '<option>Erreur</option>'; }
}

export function importerClientSelectionne() {
    const select = document.getElementById('select-import-client');
    const id = select.value;
    if(!id) return alert("Sélectionnez un client.");
    
    const data = importCache.find(d => d.id === id);
    if(data) {
        if(data.client) {
            setVal('civilite_mandant', data.client.civility);
            setVal('soussigne', data.client.nom);
            setVal('demeurant', data.client.adresse);
        }
        if(data.defunt) {
            setVal('nom', data.defunt.nom);
            if(data.defunt.naiss) setVal('date_naiss', data.defunt.naiss);
            if(data.defunt.deces) setVal('date_deces', data.defunt.deces);
        }
        alert("✅ Données importées depuis la facture !");
    }
}

// --- 3. SAUVEGARDE & GED ---
export async function sauvegarderDossier() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) btn.innerHTML = "Sauvegarde...";
    
    let gedList = [];
    document.querySelectorAll('#liste_pieces_jointes .ged-item').forEach(div => {
        // On récupère soit le nouveau format (attribut), soit l'ancien (texte)
        const name = div.getAttribute('data-name') || div.querySelector('span').innerText.replace('📄 ', '');
        if(name) gedList.push(name); // Note: Ici on ne sauve que le nom pour l'affichage liste simple si besoin, mais app.js gère le complet.
    });

    // Note: La fonction sauvegarderDossier principale est maintenant gérée dans APP.JS pour avoir tous les champs.
    // Cette fonction ici sert de fallback ou pour des updates partiels si nécessaire.
    // Mais pour éviter les conflits, app.js utilise sa propre version complète.
    // On garde celle-ci minimaliste pour ne pas casser les imports.
}

export function viderFormulaire() {
    document.getElementById('dossier_id').value = "";
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    setVal('faita', 'PERPIGNAN'); setVal('immatriculation', 'DA-081-ZQ');
    document.getElementById('liste_pieces_jointes').innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
    if(window.toggleSections) window.toggleSections();
}

export async function chargerDossier(id) {
    // Cette fonction est surchargée par app.js pour inclure tout le transport.
    // On la garde ici pour compatibilité basique.
}

export async function supprimerDossier(id) { 
    if(confirm("⚠️ Êtes-vous sûr de vouloir supprimer ce dossier définitivement ?")) { 
        await deleteDoc(doc(db,"dossiers_admin",id)); 
        chargerBaseClients(); // Recharge la liste après suppression
    } 
}

export async function chargerStock() {} 
export async function ajouterArticle() {} 
export async function supprimerArticle(id) {}
