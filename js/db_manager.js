/* js/db_manager.js - VERSION FINALE (RECHERCHE ACTIVE) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = [];
let dossiersCache = []; // dossiers_admin
let clientsRefCache = []; // collection clients
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
        `;
        refBody.appendChild(tr);
    });
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
