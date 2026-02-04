/* js/stock_manager.js */
import { db } from './config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CHARGER LE STOCK ---
export async function chargerStock() {
    const container = document.getElementById('stock-table-body');
    if(!container) return;
    container.innerHTML = '<tr><td colspan="6" style="text-align:center">Chargement...</td></tr>';

    try {
        const q = query(collection(db, "stock_articles"), orderBy("nom"));
        const snapshot = await getDocs(q);
        
        container.innerHTML = "";
        
        if(snapshot.empty) {
            container.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Stock vide.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const alertClass = (data.qte < 3) ? 'stock-alert' : 'stock-ok';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.nom}</strong><br><small style="color:#64748b;">${data.fournisseur || ''}</small></td>
                <td>${data.categorie}</td>
                <td>${data.prix_achat || 0} €</td>
                <td><strong>${data.prix_vente || 0} €</strong></td>
                <td>
                    <button class="btn-icon" onclick="window.mouvementStock('${docSnap.id}', -1, ${data.qte})">-</button>
                    <span class="badge ${alertClass}" style="font-size:0.9rem; margin:0 5px;">${data.qte}</span>
                    <button class="btn-icon" onclick="window.mouvementStock('${docSnap.id}', 1, ${data.qte})">+</button>
                </td>
                <td style="text-align:center;">
                    <button class="btn-icon" onclick="window.supprimerArticle('${docSnap.id}')" style="color:red;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            container.appendChild(tr);
        });

    } catch (e) {
        container.innerHTML = `<tr><td colspan="6" style="color:red">Erreur : ${e.message}</td></tr>`;
    }
}

// --- MOUVEMENT (+1 / -1) ---
export async function mouvementStock(id, delta, qteActuelle) {
    const newQte = parseInt(qteActuelle) + delta;
    if(newQte < 0) return alert("Stock ne peut pas être négatif.");
    
    try {
        await updateDoc(doc(db, "stock_articles", id), { qte: newQte });
        chargerStock(); 
    } catch (e) {
        alert("Erreur mise à jour : " + e.message);
    }
}

// --- AJOUTER ARTICLE ---
export async function ajouterArticle() {
    const nom = document.getElementById('st_nom').value;
    const cat = document.getElementById('st_cat').value;
    const qte = parseInt(document.getElementById('st_qte').value) || 0;
    const pa = parseFloat(document.getElementById('st_pa').value) || 0;
    const pv = parseFloat(document.getElementById('st_pv').value) || 0;
    const fourn = document.getElementById('st_fourn').value;

    if(!nom) return alert("Nom obligatoire");

    try {
        await addDoc(collection(db, "stock_articles"), {
            nom, categorie: cat, qte, prix_achat: pa, prix_vente: pv, fournisseur: fourn,
            date_ajout: new Date().toISOString()
        });
        alert("Article ajouté !");
        document.getElementById('form-stock').classList.add('hidden');
        chargerStock();
    } catch (e) {
        alert("Erreur ajout : " + e.message);
    }
}

// --- SUPPRIMER ARTICLE ---
export async function supprimerArticle(id) {
    if(confirm("Supprimer définitivement ?")) {
        await deleteDoc(doc(db, "stock_articles", id));
        chargerStock();
    }
}