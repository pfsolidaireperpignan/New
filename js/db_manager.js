/* js/db_manager.js - VERSION FINALE (RECHERCHE ACTIVE) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = [];
let clientsCache = []; // Mémoire pour la recherche
const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// --- 1. CLIENTS (CHARGEMENT + FILTRE) ---
export async function chargerBaseClients() {
    const tbody = document.getElementById('clients-table-body');
    const refBody = document.getElementById('clients-ref-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement des dossiers...</td></tr>';
    if(refBody) refBody.innerHTML = '<tr><td colspan="6" style="text-align:center">Chargement des fiches clients...</td></tr>';
    
    try {
        // On charge les 100 derniers dossiers pour avoir de la matière à chercher
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(100));
        const snapshot = await getDocs(q);
        
        clientsCache = []; // On vide le cache avant de remplir
        
        if(snapshot.empty) { 
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun dossier trouvé.</td></tr>'; 
            return; 
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            data.id = docSnap.id; // Important pour les boutons actions
            clientsCache.push(data);
        });

        // On affiche tout par défaut
        filtrerBaseClients();

        // Chargement collection clients (référentiel facturation)
        if (refBody) {
            try {
                const cQ = query(collection(db, "clients"), orderBy("nom"), limit(300));
                const cSnap = await getDocs(cQ);
                if (cSnap.empty) {
                    refBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">Aucune fiche client.</td></tr>';
                } else {
                    refBody.innerHTML = "";
                    cSnap.forEach(docSnap => {
                        const c = docSnap.data() || {};
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
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
            } catch (e) {
                refBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erreur chargement fiches clients.</td></tr>';
            }
        }

    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Erreur de chargement.</td></tr>';
        if(refBody) refBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erreur chargement fiches clients.</td></tr>';
    }
}

export function filtrerBaseClients() {
    const term = (document.getElementById('search-client')?.value || "").toLowerCase();
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = "";

    // On cherche dans le NOM DU DÉFUNT ou le NOM DU MANDANT
    const resultats = clientsCache.filter(d => {
        const defunt = `${d.defunt?.nom || ""} ${d.defunt?.prenom || ""}`.trim().toLowerCase();
        const mandant = (d.mandant?.nom || "").toLowerCase();
        return defunt.includes(term) || mandant.includes(term);
    });

    if(resultats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">Aucun résultat pour cette recherche.</td></tr>';
        return;
    }

    resultats.forEach(data => {
        const tr = document.createElement('tr');
        
        let dateCreation = '-';
        if(data.date_creation) {
            try { dateCreation = new Date(data.date_creation).toLocaleDateString(); } catch(e){}
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

// --- 2. IMPORT (FACTURATION -> DOSSIER) ---
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
