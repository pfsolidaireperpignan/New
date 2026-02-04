/* js/db_manager.js */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getVal, setVal } from './utils.js';

// --- CLIENTS ---
export async function chargerBaseClients() {
    const tbody = document.getElementById('clients-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Chargement...</td></tr>';
    
    try {
        const q = collection(db, "dossiers_admin");
        const snapshot = await getDocs(q);
        
        let dossiers = [];
        snapshot.forEach(doc => dossiers.push({ id: doc.id, ...doc.data() }));
        // Tri manuel JS pour éviter les erreurs d'index Firebase
        dossiers.sort((a, b) => new Date(b.date_creation || 0) - new Date(a.date_creation || 0));

        tbody.innerHTML = "";
        if(dossiers.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Aucun dossier.</td></tr>'; return; }

        dossiers.forEach(data => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.nom ? data.nom.toUpperCase() : ''}</strong> ${data.prenom || ''}</td>
                <td>${data.ville_deces || '-'}</td>
                <td>${data.date_creation ? new Date(data.date_creation).toLocaleDateString() : '-'}</td>
                <td><span class="badge badge-blue">Dossier</span></td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="window.chargerDossier('${data.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" onclick="window.supprimerDossier('${data.id}')" style="color:red;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erreur de chargement.</td></tr>';
    }
}

export async function chargerDossier(id) {
    try {
        const docRef = doc(db, "dossiers_admin", id);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) {
            const data = docSnap.data();
            // Remplir le formulaire Admin
            for (const [key, value] of Object.entries(data)) {
                setVal(key, value);
            }
            window.showSection('admin');
        }
    } catch(e) { alert("Erreur chargement dossier: " + e.message); }
}

export async function sauvegarderDossier() {
    const data = {
        nom: getVal('nom'),
        prenom: getVal('prenom'),
        date_deces: getVal('date_deces'),
        lieu_deces: getVal('lieu_deces'),
        code_postal_deces: getVal('code_postal_deces'),
        ville_deces: getVal('ville_deces'),
        date_mise_biere: getVal('date_mise_biere'),
        heure_mise_biere: getVal('heure_mise_biere'),
        lieu_mise_biere: getVal('lieu_mise_biere'),
        date_fermeture: getVal('date_fermeture'),
        heure_fermeture: getVal('heure_fermeture'),
        date_creation: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "dossiers_admin"), data);
        alert("Dossier sauvegardé !");
        chargerBaseClients();
        window.showSection('base');
    } catch(e) { alert("Erreur sauvegarde: " + e.message); }
}

export async function supprimerDossier(id) {
    if(confirm("Supprimer ?")) { await deleteDoc(doc(db, "dossiers_admin", id)); chargerBaseClients(); }
}

// --- STOCKS ---
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
    if(nom) { await addDoc(collection(db, "stock_articles"), {nom, categorie:cat, qte}); chargerStock(); }
}
export async function supprimerArticle(id) {
    if(confirm("Supprimer ?")) { await deleteDoc(doc(db, "stock_articles", id)); chargerStock(); }
}