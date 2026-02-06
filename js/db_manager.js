/* js/db_manager.js - VERSION TURBO (CACHE MÉMOIRE) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = [];
let clientsCache = []; // La mémoire locale des clients

// --- 1. CLIENTS (CHARGEMENT AVEC MÉMOIRE) ---
export async function chargerBaseClients(mode = 'init', forceRefresh = false) {
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    
    // 🚀 MAGIE DU CACHE : Si on a déjà les données et qu'on ne force pas le rechargement
    if (!forceRefresh && clientsCache.length > 0 && mode === 'init') {
        console.log("⚡ Chargement depuis le cache (Instantanné)");
        filtrerBaseClients(); // On affiche direct ce qu'on a en mémoire
        return; // On arrête là, pas besoin d'internet
    }

    // Sinon, on affiche le chargement et on va chercher sur Internet
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; padding:20px;">
                <i class="fas fa-circle-notch fa-spin" style="color:#3b82f6; font-size:1.5rem;"></i>
                <br><span style="color:#64748b;">Synchronisation...</span>
            </td>
        </tr>`;
    
    try {
        let q;
        if (mode === 'full') {
            q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(300));
        } else {
            q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(50)); // Augmenté à 50 pour le confort
        }

        const snapshot = await getDocs(q);
        clientsCache = []; // On met à jour la mémoire
        
        if(snapshot.empty) { 
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#94a3b8;">Aucun dossier trouvé.</td></tr>'; 
            return; 
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            data.id = docSnap.id; 
            clientsCache.push(data);
        });

        filtrerBaseClients(); // Affichage

        // Bouton "Voir plus" si nécessaire
        if (mode === 'init' && snapshot.size >= 50) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="5" style="text-align:center; background-color:#f8fafc; cursor:pointer;" onclick="window.chargerBaseClients('full', true)">
                    <button class="btn btn-blue" style="margin:5px auto; width:auto;">
                        <i class="fas fa-cloud-download-alt"></i> Charger tout l'historique...
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        }

    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red; padding:15px;">Erreur de connexion.</td></tr>';
    }
}

export function filtrerBaseClients() {
    const term = (document.getElementById('search-client')?.value || "").toLowerCase();
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    
    const loadMoreBtn = tbody.querySelector('button .fa-cloud-download-alt')?.closest('tr');
    tbody.innerHTML = "";

    const resultats = clientsCache.filter(d => {
        const defunt = (d.defunt?.nom || "").toLowerCase();
        const mandant = (d.mandant?.nom || "").toLowerCase();
        const dateStr = (d.date_creation || "").split('T')[0];
        return defunt.includes(term) || mandant.includes(term) || dateStr.includes(term);
    });

    if(resultats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:15px;">Aucun résultat.</td></tr>';
        if(loadMoreBtn) tbody.appendChild(loadMoreBtn);
        return;
    }

    resultats.forEach(data => {
        const tr = document.createElement('tr');
        let dateCreation = '-';
        if(data.date_creation) {
            try { dateCreation = new Date(data.date_creation).toLocaleDateString(); } catch(e){}
        }
        const nomDefunt = data.defunt?.nom || '<span style="color:#cbd5e1;">Inconnu</span>';
        const nomMandant = data.mandant?.nom || '-';
        const typeOp = data.technique?.type_operation || 'Dossier';

        tr.innerHTML = `
            <td>${dateCreation}</td>
            <td><strong>${nomDefunt}</strong></td>
            <td>${nomMandant}</td>
            <td><span class="badge badge-blue">${typeOp}</span></td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.chargerDossier('${data.id}')" title="Ouvrir"><i class="fas fa-eye" style="color:#3b82f6;"></i></button>
                <button class="btn-icon" onclick="window.supprimerDossier('${data.id}')" title="Supprimer"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    if(loadMoreBtn && term === "") tbody.appendChild(loadMoreBtn);
}

// --- 2. IMPORT ---
export async function chargerSelectImport() {
    const select = document.getElementById('select-import-client');
    if(!select) return;
    if(select.options.length > 1) return; // Évite de recharger si déjà fait

    select.innerHTML = '<option>Chargement...</option>';
    try {
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(20));
        const snaps = await getDocs(q);
        importCache = [];
        select.innerHTML = '<option value="">Choisir un client...</option>';
        snaps.forEach(doc => {
            const d = doc.data();
            importCache.push({ id: doc.id, ...d });
            const label = `${d.numero || d.info?.numero || '?'} - ${d.client_nom || d.client?.nom || '?'} (${d.defunt_nom || d.defunt?.nom || '?'})`;
            const opt = document.createElement('option');
            opt.value = doc.id; opt.innerText = label;
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
        const clientNom = data.client_nom || data.client?.nom;
        const clientAdr = data.client_adresse || data.client?.adresse;
        const clientCiv = data.client_civility || data.client?.civility;
        const defuntNom = data.defunt_nom || data.defunt?.nom;
        const defuntNaiss = data.defunt_date_naiss || data.defunt?.naiss;
        const defuntDeces = data.defunt_date_deces || data.defunt?.deces;

        if(clientNom) {
            setVal('civilite_mandant', clientCiv || 'M.');
            setVal('soussigne', clientNom);
            setVal('demeurant', clientAdr);
        }
        if(defuntNom) {
            setVal('nom', defuntNom);
            if(defuntNaiss) setVal('date_naiss', defuntNaiss);
            if(defuntDeces) setVal('date_deces', defuntDeces);
        }
        alert("✅ Données importées !");
    }
}

export function viderFormulaire() {
    document.getElementById('dossier_id').value = "";
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    setVal('faita', 'PERPIGNAN'); setVal('immatriculation', 'DA-081-ZQ');
    document.getElementById('liste_pieces_jointes').innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
    if(window.toggleSections) window.toggleSections();
    if(window.switchAdminTab) window.switchAdminTab('identite');
}

export async function supprimerDossier(id) { 
    if(confirm("⚠️ ATTENTION : Suppression définitive.\n\nÊtes-vous sûr ?")) { 
        try {
            await deleteDoc(doc(db,"dossiers_admin",id)); 
            // On force le rafraîchissement après suppression
            chargerBaseClients('init', true); 
        } catch(e) { alert("Erreur suppression : " + e.message); }
    } 
}

export async function chargerStock() {} 
export async function ajouterArticle() {} 
export async function supprimerArticle(id) {}
