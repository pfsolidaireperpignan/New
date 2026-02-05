/* js/db_manager.js */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

// Cache pour l'import
let importCache = [];

// --- 1. GESTION DOSSIERS ADMIN ---

export async function chargerBaseClients() {
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement...</td></tr>';
    
    try {
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
                <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${data.technique?.type_operation || 'Dossier'}</span></td>
                <td style="text-align:center;">
                    <button class="btn-icon" onclick="window.chargerDossier('${docSnap.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" onclick="window.supprimerDossier('${docSnap.id}')" style="color:red;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erreur de chargement.</td></tr>'; }
}

export async function chargerDossier(id) {
    try {
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) {
            const data = docSnap.data();
            window.showSection('admin');
            
            // On vide d'abord
            window.viderFormulaire();
            document.getElementById('dossier_id').value = id;
            
            // Remplissage Identité
            if(data.defunt) {
                setVal('civilite_defunt', data.defunt.civility);
                setVal('nom', data.defunt.nom);
                setVal('prenom', data.defunt.prenom);
                setVal('nom_jeune_fille', data.defunt.nom_jeune_fille);
                setVal('date_deces', data.defunt.date_deces);
                setVal('lieu_deces', data.defunt.lieu_deces);
                setVal('date_naiss', data.defunt.date_naiss);
                setVal('lieu_naiss', data.defunt.lieu_naiss);
                setVal('adresse_fr', data.defunt.adresse);
            }
            if(data.mandant) {
                setVal('civilite_mandant', data.mandant.civility);
                setVal('soussigne', data.mandant.nom);
                setVal('lien', data.mandant.lien);
                setVal('demeurant', data.mandant.adresse);
            }
            
            // Remplissage Technique
            if(data.technique) {
                setVal('prestation', data.technique.type_operation);
                setVal('date_fermeture', data.technique.date_fermeture);
                setVal('lieu_mise_biere', data.technique.lieu_mise_biere);
                setVal('cimetiere_nom', data.technique.cimetiere);
                setVal('date_inhumation', data.technique.date_ceremonie);
                // Déclencher l'affichage des bons blocs
                if(window.toggleSections) window.toggleSections();
            }
        }
    } catch(e) { alert("Erreur chargement dossier: " + e.message); }
}

export async function sauvegarderDossier() {
    const btn = document.getElementById('btn-save-bdd');
    if(btn) btn.innerHTML = "Sauvegarde...";
    
    const id = document.getElementById('dossier_id').value;
    const data = {
        date_modification: new Date().toISOString(),
        defunt: {
            civility: getVal('civilite_defunt'),
            nom: getVal('nom'),
            prenom: getVal('prenom'),
            nom_jeune_fille: getVal('nom_jeune_fille'),
            date_deces: getVal('date_deces'),
            lieu_deces: getVal('lieu_deces'),
            date_naiss: getVal('date_naiss'),
            lieu_naiss: getVal('lieu_naiss'),
            adresse: getVal('adresse_fr'),
            pere: getVal('pere'),
            mere: getVal('mere'),
            situation: getVal('matrimoniale'),
            conjoint: getVal('conjoint')
        },
        mandant: {
            civility: getVal('civilite_mandant'),
            nom: getVal('soussigne'),
            lien: getVal('lien'),
            adresse: getVal('demeurant')
        },
        technique: {
            type_operation: document.getElementById('prestation').value,
            lieu_mise_biere: getVal('lieu_mise_biere'),
            date_fermeture: getVal('date_fermeture'),
            cimetiere: getVal('cimetiere_nom'),
            crematorium: getVal('crematorium_nom'),
            date_ceremonie: getVal('date_inhumation') || getVal('date_cremation'),
            faita: getVal('faita'),
            date_signature: getVal('dateSignature')
        }
    };

    try {
        if (id) {
            await updateDoc(doc(db, "dossiers_admin", id), data);
            alert("Dossier mis à jour !");
        } else {
            data.date_creation = new Date().toISOString();
            const docRef = await addDoc(collection(db, "dossiers_admin"), data);
            document.getElementById('dossier_id').value = docRef.id;
            alert("Nouveau dossier créé !");
        }
        if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
        chargerBaseClients();
    } catch(e) { 
        console.error(e); 
        alert("Erreur sauvegarde: " + e.message); 
        if(btn) btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
    }
}

export async function supprimerDossier(id) {
    if(confirm("Supprimer ce dossier administrative ?")) { 
        await deleteDoc(doc(db, "dossiers_admin", id)); 
        chargerBaseClients(); 
    }
}

export function viderFormulaire() {
    document.getElementById('dossier_id').value = "";
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    document.getElementById('faita').value = "PERPIGNAN";
    document.getElementById('nationalite').value = "Française";
    document.getElementById('prestation').value = "Inhumation";
    if(window.toggleSections) window.toggleSections();
}

// --- 2. IMPORT DEPUIS FACTURATION ---

export async function chargerSelectImport() {
    const select = document.getElementById('select-import-client');
    if(!select) return;
    
    select.innerHTML = '<option>Chargement...</option>';
    importCache = [];

    try {
        // On cherche les factures/devis récents
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"), limit(20));
        const snaps = await getDocs(q);
        
        select.innerHTML = '<option value="">Choisir un client...</option>';
        
        snaps.forEach(doc => {
            const d = doc.data();
            importCache.push(d);
            const label = `${d.info?.type} ${d.info?.numero} - ${d.client?.nom} (Défunt: ${d.defunt?.nom})`;
            const opt = document.createElement('option');
            opt.value = doc.id; // On stocke l'ID du doc facture
            opt.innerText = label;
            select.appendChild(opt);
        });
    } catch(e) {
        console.error(e);
        select.innerHTML = '<option>Erreur chargement</option>';
    }
}

export function importerClientSelectionne() {
    const select = document.getElementById('select-import-client');
    const id = select.value;
    if(!id) return alert("Veuillez choisir un client dans la liste.");
    
    // Trouver les données dans le cache
    const data = importCache.find(d => select.options[select.selectedIndex].value === id || d.info?.numero === id /* fallback */);
    
    if(data) {
        // Remplir le formulaire Admin
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
        alert("Données importées avec succès ! Complétez les champs manquants.");
    }
}

// --- 3. STOCK ---
export async function chargerStock() {
    const tbody = document.getElementById('stock-table-body');
    if(!tbody) return;
    const q = query(collection(db, "stock_articles"), orderBy("nom"));
    const snap = await getDocs(q);
    tbody.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><b>${d.nom}</b></td><td>${d.categorie}</td><td>${d.qte}</td><td><button onclick="window.supprimerArticle('${doc.id}')" style="color:red;border:none;background:none;"><i class="fas fa-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
}
export async function ajouterArticle() {
    const nom = document.getElementById('st_nom').value;
    const cat = document.getElementById('st_cat').value;
    const qte = document.getElementById('st_qte').value;
    if(nom) { await addDoc(collection(db, "stock_articles"), {nom, categorie:cat, qte:parseInt(qte)}); chargerStock(); document.getElementById('form-stock').classList.add('hidden'); }
}
export async function supprimerArticle(id) {
    if(confirm("Supprimer ?")) { await deleteDoc(doc(db, "stock_articles", id)); chargerStock(); }
}
