/* js/db_manager.js - VERSION FINALE (RECHERCHE ACTIVE) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = [];
let dossiersCache = []; // dossiers_admin
let clientsRefCache = []; // collection clients
let selectedClientRef = null;
let clientsPage = 1;
const CLIENTS_PAGE_SIZE = 20;
let dossiersPage = 1;
const DOSSIERS_PAGE_SIZE = 20;
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const normalizeText = (v) => String(v || "").trim().toLowerCase();
const truncateText = (value, max = 48) => {
    const s = String(value ?? "");
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + "…";
};

function updateClientsPager(totalFiltered) {
    const total = Math.max(0, parseInt(totalFiltered || 0, 10) || 0);
    const maxPage = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
    if (clientsPage > maxPage) clientsPage = maxPage;
    if (clientsPage < 1) clientsPage = 1;

    const start = total === 0 ? 0 : ((clientsPage - 1) * CLIENTS_PAGE_SIZE + 1);
    const end = total === 0 ? 0 : Math.min(total, clientsPage * CLIENTS_PAGE_SIZE);

    const rangeEl = document.getElementById('base-clients-range');
    if (rangeEl) rangeEl.textContent = `Affichage : ${start}-${end} sur ${total}`;

    const prevBtn = document.getElementById('btn-clients-prev');
    const nextBtn = document.getElementById('btn-clients-next');
    if (prevBtn) prevBtn.disabled = clientsPage <= 1;
    if (nextBtn) nextBtn.disabled = clientsPage >= maxPage;
}

function renderClientsRefRows(refBody, rows) {
    if (!refBody) return;
    if (!rows || !rows.length) {
        refBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Aucune fiche client.</td></tr>';
        updateClientsPager(0);
        return;
    }
    updateClientsPager(rows.length);
    const startIdx = (clientsPage - 1) * CLIENTS_PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + CLIENTS_PAGE_SIZE);
    refBody.innerHTML = "";
    pageRows.forEach((c, i) => {
        const position = startIdx + i + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#64748b; font-weight:700;">${position}</td>
            <td><strong>${escapeHtml(c.nom || '-')}</strong></td>
            <td>${escapeHtml(c.telephone || '-')}</td>
            <td>${escapeHtml(c.email || '-')}</td>
            <td><span class="badge badge-blue">${escapeHtml(c.type || 'particulier')}</span></td>
            <td>${escapeHtml(c.adresse || '-')}</td>
            <td title="${escapeHtml(c.notes || '-')}" style="max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(truncateText(c.notes || '-', 55))}</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.openBaseClientDetails('${escapeHtml(c.id || '')}')" title="Ouvrir détails">
                    <i class="fas fa-eye" style="color:#3b82f6;"></i>
                </button>
                <button class="btn-icon" onclick="window.deleteBaseClient('${escapeHtml(c.id || '')}')" title="Supprimer client">
                    <i class="fas fa-trash" style="color:#ef4444;"></i>
                </button>
            </td>
        `;
        refBody.appendChild(tr);
    });
    const totalEl = document.getElementById('base-clients-count');
    const filteredEl = document.getElementById('base-clients-filtered-count');
    if (totalEl) totalEl.textContent = String(clientsRefCache.length || 0);
    if (filteredEl) filteredEl.textContent = String(rows.length || 0);
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

function formatIsoDate(d) {
    if (!d) return "-";
    try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return String(d);
        return dt.toLocaleDateString("fr-FR");
    } catch (_) {
        return String(d);
    }
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

async function renderClientPrestations(clientObj) {
    const tbody = document.getElementById('client-prestations-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Chargement...</td></tr>';

    let rows = [];
    const seen = new Set();
    const pushUnique = (item) => {
        const key = String(item?.id || "");
        if (!key || seen.has(key)) return;
        seen.add(key);
        rows.push(item);
    };
    const clientId = String(clientObj?.id || "");
    const clientNom = String(clientObj?.nom || "");
    const clientNomNorm = normalizeText(clientNom);
    try {
        if (clientId) {
            const s1 = await getDocs(query(collection(db, "dossiers_admin"), where("details_op.client_id", "==", clientId), limit(300)));
            s1.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
            const s1p = await getDocs(query(collection(db, "dossiers_admin"), where("details_op.payeur_client_id", "==", clientId), limit(300)));
            s1p.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
            const s1b = await getDocs(query(collection(db, "dossiers_admin"), where("details_op.signataire_client_id", "==", clientId), limit(300)));
            s1b.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
        }
    } catch (_) {}
    if (!rows.length && clientNom) {
        try {
            const s2 = await getDocs(query(collection(db, "dossiers_admin"), where("mandant.nom", "==", clientNom), limit(300)));
            s2.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
            const s2b = await getDocs(query(collection(db, "dossiers_admin"), where("signataire.nom", "==", clientNom), limit(300)));
            s2b.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
        } catch (_) {}
    }
    if (!rows.length && clientNom) {
        try {
            const s3 = await getDocs(query(collection(db, "dossiers_admin"), where("details_op.client_nom", "==", clientNom), limit(300)));
            s3.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
            const s3p = await getDocs(query(collection(db, "dossiers_admin"), where("details_op.payeur_client_nom", "==", clientNom), limit(300)));
            s3p.forEach(d => pushUnique({ id: d.id, ...(d.data() || {}) }));
        } catch (_) {}
    }

    // Fallback robuste: relier via factures (dossier_id) puis matcher par nom en local
    if (!rows.length) {
        try {
            const linkedDossierIds = new Set();
            if (clientId) {
                const f1 = await getDocs(query(collection(db, "factures_v2"), where("client_id", "==", clientId), limit(300)));
                f1.forEach(x => {
                    const fd = x.data() || {};
                    const did = String(fd.dossier_id || "");
                    if (did) linkedDossierIds.add(did);
                });
            }
            if (!linkedDossierIds.size && clientNom) {
                const f2 = await getDocs(query(collection(db, "factures_v2"), where("client_nom", "==", clientNom), limit(300)));
                f2.forEach(x => {
                    const fd = x.data() || {};
                    const did = String(fd.dossier_id || "");
                    if (did) linkedDossierIds.add(did);
                });
            }

            if (linkedDossierIds.size) {
                const allDossiers = await getDocs(query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(600)));
                allDossiers.forEach(d => {
                    const item = { id: d.id, ...(d.data() || {}) };
                    if (linkedDossierIds.has(String(item.id || ""))) pushUnique(item);
                });
            }

            // Dernier filet: filtrage local tolérant sur les noms
            if (!rows.length && clientNomNorm) {
                const allDossiers2 = await getDocs(query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(600)));
                allDossiers2.forEach(d => {
                    const item = { id: d.id, ...(d.data() || {}) };
                    const mandantNom = normalizeText(item?.mandant?.nom || "");
                    const signataireNom = normalizeText(item?.signataire?.nom || "");
                    const linkedNom = normalizeText(item?.details_op?.client_nom || "");
                    const linkedSignataireNom = normalizeText(item?.details_op?.signataire_client_nom || "");
                    const isMatch =
                        (mandantNom && (mandantNom.includes(clientNomNorm) || clientNomNorm.includes(mandantNom))) ||
                        (linkedNom && (linkedNom.includes(clientNomNorm) || clientNomNorm.includes(linkedNom))) ||
                        (signataireNom && (signataireNom.includes(clientNomNorm) || clientNomNorm.includes(signataireNom))) ||
                        (linkedSignataireNom && (linkedSignataireNom.includes(clientNomNorm) || clientNomNorm.includes(linkedSignataireNom)));
                    if (isMatch) pushUnique(item);
                });
            }
        } catch (_) {}
    }

    rows.sort((a, b) => String(b.date_creation || "").localeCompare(String(a.date_creation || "")));
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Aucune prestation liée.</td></tr>';
        return;
    }

    const facturesByDossier = new Map();
    try {
        const fSnap = await getDocs(query(collection(db, "factures_v2"), limit(800)));
        fSnap.forEach(fd => {
            const x = fd.data() || {};
            const dossierId = String(x.dossier_id || "");
            if (!dossierId) return;
            const total = parseFloat((x.total !== undefined) ? x.total : (x.info?.total || 0)) || 0;
            const prev = facturesByDossier.get(dossierId);
            if (!prev || total > prev.total) {
                facturesByDossier.set(dossierId, { total, date: String(x.date || x.date_creation || "") });
            }
        });
    } catch (_) {}

    tbody.innerHTML = "";
    rows.forEach(d => {
        const prestation = d?.technique?.type_operation || "Dossier";
        const defunt = `${d?.defunt?.nom || ""} ${d?.defunt?.prenom || ""}`.trim() || "-";
        const dte = formatIsoDate(d?.date_creation || d?.date_modification || "");
        const isPayeur = String(d?.details_op?.payeur_client_id || d?.details_op?.client_id || "") === String(clientObj?.id || "") || normalizeText(d?.payeur?.nom || d?.mandant?.nom || "") === normalizeText(clientObj?.nom || "");
        const isSignataire = String(d?.details_op?.signataire_client_id || "") === String(clientObj?.id || "") || normalizeText(d?.signataire?.nom || "") === normalizeText(clientObj?.nom || "");
        const role = isPayeur && isSignataire ? "Payeur + Signataire" : (isPayeur ? "Payeur/Demandeur" : (isSignataire ? "Signataire pouvoir" : "Lié"));
        const fact = facturesByDossier.get(String(d?.id || ""));
        const montant = fact ? `${(fact.total || 0).toFixed(2)} €` : "-";
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge badge-blue">${escapeHtml(prestation)}</span></td>
            <td>${escapeHtml(defunt)}</td>
            <td>${escapeHtml(dte)}</td>
            <td><span class="badge badge-gris">${escapeHtml(role)}</span></td>
            <td style="text-align:right; font-weight:700;">${escapeHtml(montant)}</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.chargerDossier('${escapeHtml(d.id)}')" title="Ouvrir dossier"><i class="fas fa-eye"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function renderClientPiecesJointes(clientObj) {
    const tbody = document.getElementById('client-pieces-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Chargement...</td></tr>';
    if (!clientObj?.id) {
        tbody.innerHTML = "<tr><td colspan=\"3\" style=\"text-align:center; color:#94a3b8;\">Enregistrez d'abord le client.</td></tr>";
        const c0 = document.getElementById('client-pieces-count');
        if (c0) c0.textContent = "0";
        return;
    }
    try {
        const parentKey = `client_${clientObj.id}`;
        const snap = await getDocs(query(collection(db, "ged_files"), where("dossier_parent", "==", parentKey), limit(300)));
        const rows = [];
        snap.forEach(d => rows.push({ id: d.id, ...(d.data() || {}) }));
        rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Aucune pièce jointe.</td></tr>';
            const c1 = document.getElementById('client-pieces-count');
            if (c1) c1.textContent = "0";
            return;
        }
        tbody.innerHTML = "";
        rows.forEach(x => {
            const href = x.url || x.content || "#";
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(x.nom || "Document")}</td>
                <td>${escapeHtml(formatIsoDate(x.date || ""))}</td>
                <td style="text-align:center;">
                    <a class="btn-icon" href="${escapeHtml(href)}" target="_blank" rel="noopener" title="Voir"><i class="fas fa-eye"></i></a>
                    <button class="btn-icon" onclick="window.deleteClientAttachment('${escapeHtml(x.id)}')" title="Supprimer"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        const c2 = document.getElementById('client-pieces-count');
        if (c2) c2.textContent = String(rows.length || 0);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ef4444;">Erreur chargement pièces jointes.</td></tr>';
        const c3 = document.getElementById('client-pieces-count');
        if (c3) c3.textContent = "0";
    }
}

export function openClientDocEditor(encodedDocId) {
    const id = decodeURIComponent(String(encodedDocId || ""));
    if (!id) return;
    window.location.href = `facturation_v2.html?doc=${encodeURIComponent(id)}`;
}

export function openClientDocPdf(encodedDocId) {
    const id = decodeURIComponent(String(encodedDocId || ""));
    if (!id) return;
    const url = `facturation_v2.html?preview=${encodeURIComponent(id)}&autoclose=1`;
    window.open(url, "_blank", "noopener,noreferrer");
}

export function openClientNewPrestation() {
    const id = selectedClientRef?.id || "";
    if (!id) return alert("Aucun client sélectionné.");
    if (typeof window.startNewPrestationFromClient === "function") {
        window.startNewPrestationFromClient(id, selectedClientRef);
        return;
    }
    window.location.href = `index.html?view=admin&new_prestation_client=${encodeURIComponent(id)}`;
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
    const tabs = ['prestations', 'factures', 'pieces'];
    tabs.forEach(t => {
        document.getElementById(`client-tab-${t}`)?.classList.remove('active');
        document.getElementById(`client-tab-content-${t}`)?.classList.add('hidden');
    });
    document.getElementById(`client-tab-${tab}`)?.classList.add('active');
    document.getElementById(`client-tab-content-${tab}`)?.classList.remove('hidden');
    if (tab === 'prestations' && selectedClientRef) renderClientPrestations(selectedClientRef);
    if (tab === 'pieces' && selectedClientRef) renderClientPiecesJointes(selectedClientRef);
}

export async function openBaseClientDetails(clientId) {
    const c = getClientById(clientId);
    if (!c) return;
    selectedClientRef = c;
    setClientDetailForm(c);
    document.getElementById('base-clients-list-view')?.classList.add('hidden');
    document.getElementById('base-client-detail-view')?.classList.remove('hidden');
    switchBaseClientDetailTab('prestations');
    await renderClientPrestations(c);
    await renderClientFacturesDevis(c);
    await renderClientPiecesJointes(c);
}

export async function saveBaseClientDetails() {
    const id = document.getElementById('detail_client_id')?.value || "";
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
        if (id) {
            await updateDoc(doc(db, "clients", id), data);
            const idx = clientsRefCache.findIndex(x => String(x.id) === String(id));
            if (idx >= 0) clientsRefCache[idx] = { ...clientsRefCache[idx], ...data };
            selectedClientRef = { ...(selectedClientRef || {}), id, ...data };
        } else {
            const payload = { ...data, created_at: new Date().toISOString() };
            const created = await addDoc(collection(db, "clients"), payload);
            selectedClientRef = { id: created.id, ...payload };
            clientsRefCache.unshift(selectedClientRef);
            const idEl = document.getElementById('detail_client_id');
            if (idEl) idEl.value = created.id;
        }
        setClientDetailForm(selectedClientRef);
        filtrerBaseClients();
        alert("✅ Modifications client enregistrées.");
    } catch (e) {
        alert("Erreur enregistrement client : " + (e?.message || e));
    }
}

export function createBaseClient() {
    selectedClientRef = { id: "", nom: "", type: "particulier", telephone: "", email: "", adresse: "", notes: "" };
    setClientDetailForm(selectedClientRef);
    document.getElementById('base-clients-list-view')?.classList.add('hidden');
    document.getElementById('base-client-detail-view')?.classList.remove('hidden');
    switchBaseClientDetailTab('prestations');
    const p = document.getElementById('client-prestations-table-body');
    if (p) p.innerHTML = "<tr><td colspan=\"6\" style=\"text-align:center; color:#94a3b8;\">Enregistrez d'abord le client pour lier des prestations.</td></tr>";
    const pj = document.getElementById('client-pieces-table-body');
    if (pj) pj.innerHTML = "<tr><td colspan=\"3\" style=\"text-align:center; color:#94a3b8;\">Enregistrez d'abord le client pour ajouter des pièces.</td></tr>";
}

export async function deleteBaseClient(clientId) {
    const id = String(clientId || "");
    if (!id) return;
    if (!confirm("Supprimer ce client ? Cette action est définitive.")) return;
    try {
        await deleteDoc(doc(db, "clients", id));
        clientsRefCache = clientsRefCache.filter(x => String(x.id) !== id);
        filtrerBaseClients();
        alert("✅ Client supprimé.");
    } catch (e) {
        alert("Erreur suppression client : " + (e?.message || e));
    }
}

export async function uploadClientAttachment() {
    if (!selectedClientRef?.id) return alert("Enregistrez d'abord le client.");
    const fileInput = document.getElementById('client_piece_input');
    const nameInput = document.getElementById('client_piece_name');
    const file = fileInput?.files?.[0];
    if (!file) return alert("Sélectionnez un fichier.");
    const isOk = (file.type || "").startsWith("image/") || file.type === "application/pdf";
    if (!isOk) return alert("Format non supporté. Utilisez PDF ou image.");
    const parentKey = `client_${selectedClientRef.id}`;
    const fileName = (nameInput?.value || file.name || "Document").trim();
    try {
        const b64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(String(e?.target?.result || ""));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        await addDoc(collection(db, "ged_files"), {
            nom: fileName,
            content: b64,
            dossier_parent: parentKey,
            date: new Date().toISOString()
        });
        if (fileInput) fileInput.value = "";
        if (nameInput) nameInput.value = "";
        await renderClientPiecesJointes(selectedClientRef);
        alert("✅ Pièce jointe ajoutée.");
    } catch (e) {
        alert("Erreur ajout pièce jointe : " + (e?.message || e));
    }
}

export async function deleteClientAttachment(fileId) {
    const id = String(fileId || "");
    if (!id) return;
    if (!confirm("Supprimer cette pièce jointe ?")) return;
    try {
        await deleteDoc(doc(db, "ged_files", id));
        if (selectedClientRef) await renderClientPiecesJointes(selectedClientRef);
    } catch (e) {
        alert("Erreur suppression pièce jointe : " + (e?.message || e));
    }
}

function guessDossierCode(data, id) {
    return data?.technique?.numero_dossier || data?.details_op?.numero_dossier || data?.numero_dossier || id || "-";
}

function renderDossiersAdminRows(tbody, rows) {
    if (!tbody) return;
    const total = Math.max(0, parseInt(rows?.length || 0, 10) || 0);
    const maxPage = Math.max(1, Math.ceil(total / DOSSIERS_PAGE_SIZE));
    if (dossiersPage < 1) dossiersPage = 1;
    if (dossiersPage > maxPage) dossiersPage = maxPage;

    const start = total === 0 ? 0 : ((dossiersPage - 1) * DOSSIERS_PAGE_SIZE + 1);
    const end = total === 0 ? 0 : Math.min(total, dossiersPage * DOSSIERS_PAGE_SIZE);
    const rangeEl = document.getElementById('admin-dossiers-range');
    if (rangeEl) rangeEl.textContent = `Affichage : ${start}-${end} sur ${total}`;
    const prevBtn = document.getElementById('btn-admin-prev');
    const nextBtn = document.getElementById('btn-admin-next');
    if (prevBtn) prevBtn.disabled = dossiersPage <= 1;
    if (nextBtn) nextBtn.disabled = dossiersPage >= maxPage;

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Aucun dossier trouvé.</td></tr>';
        return;
    }
    const startIdx = (dossiersPage - 1) * DOSSIERS_PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + DOSSIERS_PAGE_SIZE);
    tbody.innerHTML = "";
    pageRows.forEach(data => {
        const tr = document.createElement('tr');
        let dateCreation = '-';
        if (data.date_creation) {
            try { dateCreation = new Date(data.date_creation).toLocaleDateString(); } catch (_) {}
        }
        const defuntNomComplet = `${data.defunt?.nom || ''} ${data.defunt?.prenom || ''}`.trim();
        tr.innerHTML = `
            <td>${dateCreation}</td>
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
            clientsPage = 1;
            renderClientsRefRows(refBody, clientsRefCache);
        } catch (e) {
            try {
                const fallbackSnap = await getDocs(query(collection(db, "clients"), limit(300)));
                clientsRefCache = [];
                fallbackSnap.forEach(docSnap => clientsRefCache.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
                clientsRefCache.sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), 'fr'));
                clientsPage = 1;
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
    clientsPage = 1;
    renderClientsRefRows(refBody, resultats);
}

export function baseClientsNextPage() {
    clientsPage += 1;
    renderClientsRefRows(document.getElementById('clients-ref-table-body'), clientsRefCache.filter(c => {
        const term = (document.getElementById('search-client')?.value || "").toLowerCase();
        const txt = `${c.id || ""} ${c.nom || ""} ${c.telephone || ""} ${c.email || ""} ${c.type || ""} ${c.adresse || ""} ${c.notes || ""}`.toLowerCase();
        return txt.includes(term);
    }));
}

export function baseClientsPrevPage() {
    clientsPage -= 1;
    renderClientsRefRows(document.getElementById('clients-ref-table-body'), clientsRefCache.filter(c => {
        const term = (document.getElementById('search-client')?.value || "").toLowerCase();
        const txt = `${c.id || ""} ${c.nom || ""} ${c.telephone || ""} ${c.email || ""} ${c.type || ""} ${c.adresse || ""} ${c.notes || ""}`.toLowerCase();
        return txt.includes(term);
    }));
}

// --- 2. DOSSIERS ADMIN (liste déplacée depuis Base Clients) ---
export async function chargerDossiersAdminList() {
    const tbody = document.getElementById('dossiers-admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement des dossiers...</td></tr>';
    try {
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(200));
        const snapshot = await getDocs(q);
        dossiersCache = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data() || {};
            data.id = docSnap.id;
            dossiersCache.push(data);
        });
        dossiersPage = 1;
        filtrerDossiersAdmin();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Erreur chargement dossiers.</td></tr>';
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

export function adminDossiersNextPage() {
    dossiersPage += 1;
    filtrerDossiersAdmin();
}

export function adminDossiersPrevPage() {
    dossiersPage -= 1;
    filtrerDossiersAdmin();
}

// --- 3. IMPORT (FACTURATION -> DOSSIER) ---
export async function chargerSelectImport() {
    const select = document.getElementById('select-import-client');
    if(!select) return;
    select.innerHTML = '<option>Chargement...</option>';
    
    try {
        importCache = [];
        select.innerHTML = '<option value="">Choisir un client...</option>';

        let snaps = null;
        try {
            snaps = await getDocs(query(collection(db, "clients"), orderBy("nom"), limit(600)));
        } catch (_) {
            snaps = await getDocs(query(collection(db, "clients"), limit(600)));
        }

        const rows = [];
        snaps.forEach(docSnap => rows.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
        rows.sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), 'fr'));
        importCache = rows;

        rows.forEach(c => {
            const label = `${c.nom || "Client"}${c.telephone ? " — " + c.telephone : ""}`;
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = label;
            select.appendChild(opt);
        });
    } catch(e) { console.error(e); select.innerHTML = '<option>Erreur</option>'; }
}

export function importerClientSelectionne() {
    const select = document.getElementById('select-import-client');
    const id = select.value;
    if(!id) return alert("Sélectionnez un client.");
    
    const c = importCache.find(x => String(x.id) === String(id));
    if(!c) return alert("Client introuvable.");

    // Pré-remplissage dossier (mandant/signataire)
    setVal('soussigne', c.nom || "");
    setVal('tel_mandant', c.telephone || "");
    setVal('demeurant', c.adresse || "");

    // Par défaut payeur = mandant (ne force pas le toggle)
    try {
        const chkPayeur = document.getElementById('payeur_different');
        if (chkPayeur && !chkPayeur.checked) {
            const payeurIdEl = document.getElementById('payeur_client_id');
            const payeurNomEl = document.getElementById('payeur_nom');
            const payeurTelEl = document.getElementById('payeur_tel');
            const payeurEmailEl = document.getElementById('payeur_email');
            const payeurAdrEl = document.getElementById('payeur_adresse');
            if (payeurIdEl) payeurIdEl.value = c.id || "";
            if (payeurNomEl) payeurNomEl.value = c.nom || "";
            if (payeurTelEl) payeurTelEl.value = c.telephone || "";
            if (payeurEmailEl) payeurEmailEl.value = c.email || "";
            if (payeurAdrEl) payeurAdrEl.value = c.adresse || "";
            if (window.updatePayeurLinkBadge) window.updatePayeurLinkBadge(!!c.id, c.nom || "");
        }
    } catch (_) {}

    alert("✅ Données importées depuis la Base Clients.");
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
    document.querySelectorAll('#view-admin input[type="checkbox"]').forEach(i => i.checked = false);
    setVal('faita', 'PERPIGNAN'); setVal('immatriculation', 'DA-081-ZQ');
    document.getElementById('liste_pieces_jointes').innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
    if(window.toggleSections) window.toggleSections();
    if(window.togglePayeurSection) window.togglePayeurSection();
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
