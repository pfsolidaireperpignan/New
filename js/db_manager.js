/* js/db_manager.js - VERSION CORRIGÉE (ADMIN + GED + IMPORT) */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

let importCache = []; // Stocke les factures pour l'import

// --- 1. CHARGEMENT BASE CLIENTS (RAPIDE) ---
export async function chargerBaseClients() {
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement...</td></tr>';
    
    try {
        // On limite à 50 pour éviter les lenteurs
        const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc"), limit(50));
        const snapshot = await getDocs(q);
        
        tbody.innerHTML = "";
        if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun dossier.</td></tr>'; return; }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.date_creation ? new Date(data.date_creation).toLocaleDateString() : '-'}</td>
                <td><strong>${data.defunt?.nom || '?'}</strong></td>
                <td>${data.mandant?.nom || '?'}</td>
                <td><span class="badge badge-blue">${data.technique?.type_operation || 'Dossier'}</span></td>
                <td style="text-align:center;">
                    <button class="btn-icon" onclick="window.chargerDossier('${docSnap.id}')" title="Modifier"><i class="fas fa-eye" style="color:#3b82f6;"></i></button>
                    <button class="btn-icon" onclick="window.supprimerDossier('${docSnap.id}')" title="Supprimer"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
                </td>`;
            tbody.appendChild(tr);
        });
    } catch (e) { 
        console.error(e); 
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erreur de chargement.</td></tr>'; 
    }
}

// --- 2. IMPORT DEPUIS FACTURATION (C'est cette fonction qui manquait !) ---
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
    } catch(e) {
        console.error(e);
        select.innerHTML = '<option>Erreur chargement liste</option>';
    }
}

export function importerClientSelectionne() {
    const select = document.getElementById('select-import-client');
    const id = select.value;
    if(!id) return alert("Veuillez sélectionner une facture dans la liste.");
    
    const data = importCache.find(d => d.id === id);
    if(data) {
        if(data.client) {
            setVal('civilite_mandant', data.client.civility);
            setVal('soussigne', data.client.nom);
            setVal('demeurant', data.client.adresse);
        }
        if(data.defunt) {
            setVal('civilite_defunt', data.defunt.civility);
            setVal('nom', data.defunt.nom);
            setVal('date_naiss', data.defunt.date_naiss);
            setVal('date_deces', data.defunt.date_deces);
        }
        alert("✅ Import réussi ! Complétez les autres champs.");
    }
}

// --- 3. GESTION DOSSIER (SAUVEGARDE & GED) ---
export function viderFormulaire() {
    document.getElementById('dossier_id').value = "";
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    setVal('faita', 'PERPIGNAN');
    setVal('nationalite', 'Française');
    setVal('immatriculation', 'DA-081-ZQ');
    document.getElementById('liste_pieces_jointes').innerHTML = '<div style="color:#94a3b8; font-style:italic;">Aucun document joint.</div>';
    if(window.toggleSections) window.toggleSections();
}

export async function chargerDossier(id) {
    try {
        const docSnap = await getDoc(doc(db, "dossiers_admin", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.showSection('admin');
            viderFormulaire();
            document.getElementById('dossier_id').value = id;
            
            // Remplissage
            if(data.defunt) {
                setVal('civilite_defunt', data.defunt.civility); setVal('nom', data.defunt.nom); setVal('prenom', data.defunt.prenom);
                setVal('nom_jeune_fille', data.defunt.nom_jeune_fille); setVal('date_deces', data.defunt.date_deces);
                setVal('lieu_deces', data.defunt.lieu_deces); setVal('date_naiss', data.defunt.date_naiss);
                setVal('lieu_naiss', data.defunt.lieu_naiss); setVal('adresse_fr', data.defunt.adresse);
                setVal('pere', data.defunt.pere); setVal('mere', data.defunt.mere);
                setVal('matrimoniale', data.defunt.situation); setVal('conjoint', data.defunt.conjoint);
                setVal('profession_libelle', data.defunt.profession);
            }
            if(data.mandant) {
                setVal('civilite_mandant', data.mandant.civility); setVal('soussigne', data.mandant.nom);
                setVal('lien', data.mandant.lien); setVal('demeurant', data.mandant.adresse);
            }
            if(data.technique) {
                setVal('prestation', data.technique.type_operation); setVal('lieu_mise_biere', data.technique.lieu_mise_biere);
                setVal('date_fermeture', data.technique.date_fermeture); setVal('cimetiere_nom', data.technique.cimetiere);
                setVal('crematorium_nom', data.technique.crematorium); setVal('date_inhumation', data.technique.date_ceremonie);
                setVal('heure_inhumation', data.technique.heure_ceremonie); setVal('num_concession', data.technique.num_concession);
                setVal('faita', data.technique.faita); setVal('dateSignature', data.technique.date_signature);
                // Police
                if(data.technique.police_nom) {
                    document.getElementById('type_presence_select').value = 'police';
                    setVal('p_nom_grade', data.technique.police_nom); setVal('p_commissariat', data.technique.police_commissariat);
                }
            }
            // GED (Chargement)
            const gedDiv = document.getElementById('liste_pieces_jointes');
            if(data.ged && data.ged.length > 0) {
                gedDiv.innerHTML = "";
                data.ged.forEach(name => {
                    gedDiv.innerHTML += `<div style="background:white; padding:5px; border:1px solid #ddd; margin-bottom:5px;">📄 ${name}</div>`;
                });
            }
            
            if(window.toggleSections) window.toggleSections();
            if(window.togglePolice) window.togglePolice();
        }
    } catch(e) { alert("Erreur chargement : " + e.message); }
}

export async function sauvegarderDossier() {
    const btn = document.getElementById('btn-save-bdd');
    btn.innerHTML = "Sauvegarde...";
    
    const id = document.getElementById('dossier_id').value;
    
    // GED : On récupère la liste visible à l'écran
    let gedList = [];
    document.querySelectorAll('#liste_pieces_jointes div').forEach(div => {
        // On nettoie le texte pour ne garder que le nom du fichier
        let text = div.innerText.replace('📄 ', '').replace('Aucun document joint.', '').trim();
        if(text) gedList.push(text);
    });

    const data = {
        date_modification: new Date().toISOString(),
        defunt: {
            civility: getVal('civilite_defunt'), nom: getVal('nom'), prenom: getVal('prenom'),
            nom_jeune_fille: getVal('nom_jeune_fille'), date_deces: getVal('date_deces'),
            lieu_deces: getVal('lieu_deces'), date_naiss: getVal('date_naiss'),
            lieu_naiss: getVal('lieu_naiss'), adresse: getVal('adresse_fr'),
            pere: getVal('pere'), mere: getVal('mere'), situation: getVal('matrimoniale'),
            conjoint: getVal('conjoint'), profession: getVal('profession_libelle')
        },
        mandant: {
            civility: getVal('civilite_mandant'), nom: getVal('soussigne'),
            lien: getVal('lien'), adresse: getVal('demeurant')
        },
        technique: {
            type_operation: document.getElementById('prestation').value,
            lieu_mise_biere: getVal('lieu_mise_biere'), date_fermeture: getVal('date_fermeture'),
            cimetiere: getVal('cimetiere_nom'), crematorium: getVal('crematorium_nom'),
            date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'),
            heure_ceremonie: getVal('heure_inhumation') || getVal('heure_cremation'),
            num_concession: getVal('num_concession'), faita: getVal('faita'),
            date_signature: getVal('dateSignature'),
            police_nom: getVal('p_nom_grade'), police_commissariat: getVal('p_commissariat')
        },
        transport: {
            av_dep: getVal('av_lieu_depart'), av_arr: getVal('av_lieu_arrivee'),
            ap_dep: getVal('ap_lieu_depart'), ap_arr: getVal('ap_lieu_arrivee'),
            rap_pays: getVal('rap_pays'), rap_ville: getVal('rap_ville'), rap_lta: getVal('rap_lta')
        },
        ged: gedList // Sauvegarde de la liste des fichiers
    };

    try {
        if(id) { await updateDoc(doc(db, "dossiers_admin", id), data); alert("✅ Dossier mis à jour !"); }
        else { 
            data.date_creation = new Date().toISOString(); 
            const ref = await addDoc(collection(db, "dossiers_admin"), data); 
            document.getElementById('dossier_id').value = ref.id;
            alert("✅ Nouveau dossier créé !"); 
        }
        chargerBaseClients();
    } catch(e) { alert("Erreur sauvegarde: " + e.message); }
    btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
}

export async function supprimerDossier(id) {
    if(confirm("Supprimer ce dossier ?")) { await deleteDoc(doc(db, "dossiers_admin", id)); chargerBaseClients(); }
}

// --- STOCKS (On garde pour que ça marche aussi) ---
export async function chargerStock() { /* ...code stock inchangé... */ }
export async function ajouterArticle() { /* ... */ }
export async function supprimerArticle(id) { /* ... */ }
