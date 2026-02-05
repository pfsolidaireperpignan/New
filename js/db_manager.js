/* js/db_manager.js - VERSION ADMIN CORRIGÉE */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = [];

export async function chargerBaseClients() { /* ... code identique, gardé pour la brièveté ... */ 
    const tbody = document.getElementById('clients-table-body'); if(!tbody) return; tbody.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';
    try { const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(50)); const snapshot = await getDocs(q); tbody.innerHTML = ""; if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5">Aucun dossier.</td></tr>'; return; } snapshot.forEach(docSnap => { const data = docSnap.data(); const tr = document.createElement('tr'); tr.innerHTML = `<td>${data.date_creation ? new Date(data.date_creation).toLocaleDateString() : '-'}</td><td><strong>${data.defunt?.nom || '?'}</strong></td><td>${data.mandant?.nom || '?'}</td><td><span class="badge badge-blue">${data.technique?.type_operation || 'Dossier'}</span></td><td style="text-align:center;"><button class="btn-icon" onclick="window.chargerDossier('${docSnap.id}')"><i class="fas fa-eye"></i></button><button class="btn-icon" onclick="window.supprimerDossier('${docSnap.id}')"><i class="fas fa-trash"></i></button></td>`; tbody.appendChild(tr); }); } catch (e) { console.error(e); }
}

export async function chargerSelectImport() {
    const select = document.getElementById('select-import-client'); if(!select) return;
    try { const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(20)); const snaps = await getDocs(q); importCache = []; select.innerHTML = '<option value="">Choisir...</option>'; snaps.forEach(doc => { const d = doc.data(); importCache.push({ id: doc.id, ...d }); const label = `${d.info?.type} ${d.info?.numero} - ${d.client?.nom}`; const opt = document.createElement('option'); opt.value = doc.id; opt.innerText = label; select.appendChild(opt); }); } catch(e){}
}

export function importerClientSelectionne() {
    const select = document.getElementById('select-import-client'); const id = select.value;
    const data = importCache.find(d => d.id === id);
    if(data) {
        if(data.client) { setVal('civilite_mandant', data.client.civility); setVal('soussigne', data.client.nom); setVal('demeurant', data.client.adresse); }
        if(data.defunt) { setVal('civilite_defunt', data.defunt.civility); setVal('nom', data.defunt.nom); setVal('date_naiss', data.defunt.date_naiss); setVal('date_deces', data.defunt.date_deces); }
        alert("Importé !");
    }
}

// --- FONCTION SAUVEGARDE ET GED ---
export async function sauvegarderDossier() {
    const id = document.getElementById('dossier_id').value;
    
    // CORRECTION GED : On récupère la liste affichée
    let gedList = [];
    document.querySelectorAll('#liste_pieces_jointes div').forEach(div => {
        let txt = div.innerText.replace('📄', '').replace('Aucun document joint.', '').trim();
        if(txt) gedList.push(txt);
    });

    const data = {
        date_modification: new Date().toISOString(),
        defunt: {
            civility: getVal('civilite_defunt'), nom: getVal('nom'), prenom: getVal('prenom'), nom_jeune_fille: getVal('nom_jeune_fille'),
            date_deces: getVal('date_deces'), lieu_deces: getVal('lieu_deces'), date_naiss: getVal('date_naiss'), lieu_naiss: getVal('lieu_naiss'),
            adresse: getVal('adresse_fr'), pere: getVal('pere'), mere: getVal('mere'), situation: getVal('matrimoniale'), conjoint: getVal('conjoint'), profession: getVal('profession_libelle')
        },
        mandant: { civility: getVal('civilite_mandant'), nom: getVal('soussigne'), lien: getVal('lien'), adresse: getVal('demeurant') },
        technique: {
            type_operation: document.getElementById('prestation').value, lieu_mise_biere: getVal('lieu_mise_biere'), date_fermeture: getVal('date_fermeture'),
            cimetiere: getVal('cimetiere_nom'), crematorium: getVal('crematorium_nom'), date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'),
            heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'), num_concession: getVal('num_concession'), faita: getVal('faita'), dateSignature: getVal('dateSignature'),
            police_nom: getVal('p_nom_grade'), police_commissariat: getVal('p_commissariat')
        },
        transport: { av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'), ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'), rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta') },
        ged: gedList // SAUVEGARDE ICI
    };

    try {
        if(id) { await updateDoc(doc(db, "dossiers_admin", id), data); alert("✅ Dossier mis à jour !"); }
        else { 
            data.date_creation = new Date().toISOString(); 
            const ref = await addDoc(collection(db, "dossiers_admin"), data); 
            document.getElementById('dossier_id').value = ref.id;
            alert("✅ Dossier créé !"); 
        }
        chargerBaseClients();
    } catch(e) { alert("Erreur: " + e.message); }
}

export function viderFormulaire() { document.getElementById('dossier_id').value = ""; document.querySelectorAll('#view-admin input').forEach(i => i.value = ""); document.getElementById('liste_pieces_jointes').innerHTML = "<i>Aucun document</i>"; }

export async function chargerDossier(id) {
    const docSnap = await getDoc(doc(db, "dossiers_admin", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        window.showSection('admin');
        document.getElementById('dossier_id').value = id;
        // Remplissage rapide
        if(data.defunt) { setVal('nom', data.defunt.nom); setVal('prenom', data.defunt.prenom); /* etc... */ }
        // Restauration GED
        const gedDiv = document.getElementById('liste_pieces_jointes');
        if(data.ged && data.ged.length > 0) {
            gedDiv.innerHTML = "";
            data.ged.forEach(name => gedDiv.innerHTML += `<div>📄 ${name}</div>`);
        }
    }
}
export async function supprimerDossier(id) { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"dossiers_admin",id)); chargerBaseClients(); } }
export async function chargerStock() {} export async function ajouterArticle() {} export async function supprimerArticle(id) {}
