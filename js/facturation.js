/* js/facturation.js - VERSION FINALE (ACHATS RICHES + FACTURATION CORRIGÉE) */
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- VARIABLES GLOBALES ---
let cacheDepenses = [];
let currentFactureId = null;
let lignesFacture = []; // Tableau temporaire pour les lignes de facture

// --- 1. INITIALISATION & NAVIGATION ---

window.addEventListener('DOMContentLoaded', () => {
    // Initialiser la date du jour
    const dateInput = document.getElementById('facture_date');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    // Charger l'historique des factures au démarrage
    window.chargerHistoriqueFactures();
});

window.switchTab = function(tab) {
    // Gestion des classes actives
    document.getElementById('btn-tab-factures').classList.remove('active');
    document.getElementById('btn-tab-achats').classList.remove('active');
    document.getElementById('tab-factures').classList.add('hidden');
    document.getElementById('tab-achats').classList.add('hidden');

    if (tab === 'factures') {
        document.getElementById('btn-tab-factures').classList.add('active');
        document.getElementById('tab-factures').classList.remove('hidden');
    } else {
        document.getElementById('btn-tab-achats').classList.add('active');
        document.getElementById('tab-achats').classList.remove('hidden');
        window.chargerDepenses(); // On recharge les dépenses quand on clique
    }
};

// --- 2. GESTION DES DÉPENSES (ACHATS) - NOUVEAU CODE ---

window.chargerDepenses = async function() {
    const tbody = document.getElementById('depenses-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Chargement...</td></tr>';
    
    try {
        const q = query(collection(db, "depenses"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        cacheDepenses = [];
        let total = 0;
        
        snapshot.forEach(doc => {
            cacheDepenses.push({ id: doc.id, ...doc.data() });
        });

        // Calcul stats globales
        cacheDepenses.forEach(d => total += parseFloat(d.montant || 0));
        document.getElementById('stat-depenses').innerText = total.toFixed(2) + " €";
        
        // Affichage
        window.filtrerDepenses();
        
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" style="color:red; text-align:center">Erreur de chargement.</td></tr>';
    }
};

window.filtrerDepenses = function() {
    const term = document.getElementById('search_depense').value.toLowerCase();
    const dateStart = document.getElementById('filter_date_start').value;
    const dateEnd = document.getElementById('filter_date_end').value;
    const cat = document.getElementById('filter_cat').value;
    const statut = document.getElementById('filter_statut').value;
    
    const tbody = document.getElementById('depenses-body');
    tbody.innerHTML = "";
    
    const filtered = cacheDepenses.filter(d => {
        const textMatch = (d.fournisseur+d.details+d.categorie).toLowerCase().includes(term);
        let dateMatch = true;
        if(dateStart && d.date < dateStart) dateMatch = false;
        if(dateEnd && d.date > dateEnd) dateMatch = false;
        let catMatch = true; if(cat && d.categorie !== cat) catMatch = false;
        let statutMatch = true; if(statut && d.statut !== statut) statutMatch = false;
        return textMatch && dateMatch && catMatch && statutMatch;
    });

    const totalFilter = filtered.reduce((s, d) => s + parseFloat(d.montant||0), 0);
    document.getElementById('total-filtre-display').innerText = totalFilter.toFixed(2) + " €";

    filtered.forEach(d => {
        // Badges
        const badgeStatut = d.statut === 'Réglé' 
            ? `<span class="badge badge-regle"><i class="fas fa-check"></i> Réglé</span>` 
            : `<span class="badge badge-attente" style="cursor:pointer;" title="Cliquez pour régler"><i class="fas fa-clock"></i> À payer</span>`;
        
        const badgeMode = d.mode ? `<span class="badge" style="background:#f3f4f6; color:#4b5563; border:1px solid #e5e7eb;">${d.mode}</span>` : '-';

        // Dates
        let dateHtml = `<div><small style="color:#6b7280">Fac:</small> <strong>${new Date(d.date).toLocaleDateString()}</strong></div>`;
        if(d.date_reglement) {
            dateHtml += `<div style="margin-top:2px;"><small style="color:#10b981">Rég:</small> ${new Date(d.date_reglement).toLocaleDateString()}</div>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateHtml}</td>
            <td>
                <div style="font-weight:700; font-size:1rem;">${d.fournisseur}</div>
                ${d.ref ? `<div style="font-size:0.8em; color:#6b7280;">Réf: ${d.ref}</div>` : ''}
            </td>
            <td>
                <div style="color:#374151; font-weight:600;">${d.categorie}</div>
                ${d.details ? `<div style="font-size:0.85em; color:#6b7280; font-style:italic;">${d.details}</div>` : ''}
            </td>
            <td style="text-align:center;">${badgeMode}</td>
            <td style="text-align:center;">${badgeStatut}</td>
            <td style="text-align:right; font-weight:800; font-size:1.1rem; color:#dc2626;">-${parseFloat(d.montant).toFixed(2)} €</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.preparerModification('${d.id}')" title="Modifier"><i class="fas fa-pen" style="color:#3b82f6;"></i></button>
                <button class="btn-icon" onclick="window.supprimerDepense('${d.id}')" title="Supprimer"><i class="fas fa-trash" style="color:#ef4444;"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.toggleNewExpenseForm = function() {
    const container = document.getElementById('container-form-depense');
    const isOpen = container.classList.contains('open');
    
    if (isOpen) {
        container.classList.remove('open');
    } else {
        // Reset du formulaire
        document.getElementById('form-depense').reset();
        document.getElementById('dep_edit_id').value = "";
        document.getElementById('dep_date_fac').value = new Date().toISOString().split('T')[0];
        document.getElementById('btn-action-depense').innerHTML = '<i class="fas fa-check"></i> ENREGISTRER';
        container.classList.add('open');
    }
};

window.gererDepense = async function() {
    const btn = document.getElementById('btn-action-depense');
    btn.innerHTML = 'Enregistrement...'; btn.disabled = true;

    try {
        const id = document.getElementById('dep_edit_id').value;
        const data = {
            date: document.getElementById('dep_date_fac').value,
            fournisseur: document.getElementById('dep_fourn').value,
            ref: document.getElementById('dep_ref').value,
            categorie: document.getElementById('dep_cat').value,
            details: document.getElementById('dep_details').value,
            montant: parseFloat(document.getElementById('dep_montant').value) || 0,
            statut: document.getElementById('dep_statut').value,
            mode: document.getElementById('dep_mode').value,
            date_reglement: document.getElementById('dep_date_reg').value,
            updated_at: new Date().toISOString()
        };

        if (!data.fournisseur || data.montant === 0) {
            alert("Merci de remplir le Fournisseur et le Montant.");
            btn.innerHTML = '<i class="fas fa-check"></i> ENREGISTRER'; btn.disabled = false;
            return;
        }

        if (id) {
            await updateDoc(doc(db, "depenses", id), data);
        } else {
            data.created_at = new Date().toISOString();
            await addDoc(collection(db, "depenses"), data);
        }

        window.toggleNewExpenseForm();
        window.chargerDepenses();
        alert("Enregistré avec succès !");

    } catch (e) {
        console.error(e);
        alert("Erreur : " + e.message);
    }
    btn.innerHTML = '<i class="fas fa-check"></i> ENREGISTRER'; btn.disabled = false;
};

window.preparerModification = function(id) {
    const d = cacheDepenses.find(x => x.id === id);
    if(d) {
        document.getElementById('dep_edit_id').value = id;
        document.getElementById('dep_date_fac').value = d.date;
        document.getElementById('dep_ref').value = d.ref || "";
        document.getElementById('dep_fourn').value = d.fournisseur;
        document.getElementById('dep_montant').value = d.montant;
        document.getElementById('dep_cat').value = d.categorie;
        document.getElementById('dep_details').value = d.details || "";
        document.getElementById('dep_statut').value = d.statut;
        document.getElementById('dep_mode').value = d.mode;
        document.getElementById('dep_date_reg').value = d.date_reglement || "";

        document.getElementById('btn-action-depense').innerHTML = "MODIFIER";
        document.getElementById('container-form-depense').classList.add('open');
        document.getElementById('form-depense').scrollIntoView({behavior: "smooth"});
    }
};

window.supprimerDepense = async function(id) {
    if(confirm("Supprimer définitivement cette dépense ?")) {
        await deleteDoc(doc(db, "depenses", id));
        window.chargerDepenses();
    }
};

window.exportCsvAchats = function() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date;Fournisseur;Reference;Categorie;Details;Montant;Statut;Mode;Date Reglement\n";
    cacheDepenses.forEach(d => {
        csvContent += `${d.date};${d.fournisseur};${d.ref||''};${d.categorie};${d.details||''};${d.montant};${d.statut};${d.mode||''};${d.date_reglement||''}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "export_achats.csv");
    document.body.appendChild(link);
    link.click();
};


// --- 3. GESTION DES FACTURES (VENTES) ---

// Création nouveau Devis/Facture
window.creerNouveau = function(type) {
    currentFactureId = null;
    lignesFacture = [];
    
    // Reset Formulaire
    document.getElementById('modal-choix').classList.add('hidden');
    document.getElementById('liste-factures-container').classList.add('hidden');
    document.getElementById('editeur-facture').classList.remove('hidden');
    
    // Titres & Dates
    document.getElementById('doc_type_title').innerText = type; // DEVIS ou FACTURE
    document.getElementById('doc_num').innerText = "BROUILLON";
    document.getElementById('facture_date').value = new Date().toISOString().split('T')[0];
    
    // Vider champs Client
    document.getElementById('client_nom').value = "";
    document.getElementById('client_adresse').value = "";
    document.getElementById('client_cp').value = "";
    document.getElementById('client_ville').value = "";
    
    // Vider champs Défunt
    document.getElementById('defunt_nom').value = "";
    document.getElementById('defunt_date_deces').value = "";
    document.getElementById('defunt_ville_deces').value = "";
    
    window.renderLignes();
};

window.fermerEditeur = function() {
    if(confirm("Si vous n'avez pas enregistré, les données seront perdues. Quitter ?")) {
        document.getElementById('editeur-facture').classList.add('hidden');
        document.getElementById('liste-factures-container').classList.remove('hidden');
        window.chargerHistoriqueFactures();
    }
};

// Gestion des lignes (Articles)
window.ajouterLigne = function(desc = "", prix = 0) {
    lignesFacture.push({ type: 'article', designation: desc, prix: prix });
    window.renderLignes();
};

window.ajouterTitreSection = function() {
    lignesFacture.push({ type: 'titre', designation: 'NOUVELLE SECTION', prix: 0 });
    window.renderLignes();
};

window.supprimerLigne = function(index) {
    lignesFacture.splice(index, 1);
    window.renderLignes();
};

window.loadTemplate = function(modeleName) {
    const MODELES = {
        "Inhumation": [
            { type: 'titre', designation: 'ORGANISATION DES OBSÈQUES' },
            { type: 'article', designation: 'Démarches administratives', prix: 250 },
            { type: 'article', designation: 'Véhicule de cérémonie', prix: 350 },
            { type: 'titre', designation: 'CERCUEIL & ACCESSOIRES' },
            { type: 'article', designation: 'Cercueil Chêne standard', prix: 890 },
            { type: 'article', designation: 'Capiton', prix: 80 }
        ],
        "Cremation": [
            { type: 'titre', designation: 'ORGANISATION CRÉMATION' },
            { type: 'article', designation: 'Démarches et réservation', prix: 250 },
            { type: 'article', designation: 'Cercueil Crémation (Pin)', prix: 650 },
            { type: 'article', designation: 'Urne cinéraire', prix: 120 }
        ]
    };
    
    if(MODELES[modeleName]) {
        lignesFacture = [...lignesFacture, ...MODELES[modeleName]];
        window.renderLignes();
    }
};

window.renderLignes = function() {
    const tbody = document.getElementById('lignes_facture');
    tbody.innerHTML = "";
    let totalHT = 0;

    lignesFacture.forEach((ligne, index) => {
        const tr = document.createElement('tr');
        
        if(ligne.type === 'titre') {
            tr.innerHTML = `
                <td colspan="4" style="background:#f1f5f9; padding:0;">
                    <input value="${ligne.designation}" onchange="lignesFacture[${index}].designation = this.value" 
                    style="width:100%; border:none; background:transparent; font-weight:bold; padding:10px; color:#334155;">
                    <i class="fas fa-trash" onclick="window.supprimerLigne(${index})" style="float:right; margin:10px; cursor:pointer; color:#94a3b8;"></i>
                </td>
            `;
        } else {
            totalHT += parseFloat(ligne.prix);
            tr.innerHTML = `
                <td style="text-align:center; color:#cbd5e1;"><i class="fas fa-grip-vertical"></i></td>
                <td><input value="${ligne.designation}" onchange="lignesFacture[${index}].designation = this.value" style="border:none; width:100%;"></td>
                <td><input type="number" value="${ligne.prix}" onchange="lignesFacture[${index}].prix = parseFloat(this.value); window.renderLignes();" style="border:none; width:100%; text-align:right;"></td>
                <td style="text-align:center;"><i class="fas fa-trash" onclick="window.supprimerLigne(${index})" style="cursor:pointer; color:#ef4444;"></i></td>
            `;
        }
        tbody.appendChild(tr);
    });

    const tva = totalHT * 0.20;
    const ttc = totalHT + tva;
    
    document.getElementById('total_ht').innerText = totalHT.toFixed(2) + " €";
    document.getElementById('total_tva').innerText = tva.toFixed(2) + " €";
    document.getElementById('total_ttc').innerText = ttc.toFixed(2) + " €";
};

// Sauvegarde dans Firebase
window.sauvegarderFactureBase = async function() {
    const btn = document.getElementById('btn-save-facture');
    btn.innerHTML = "Enregistrement...";
    btn.disabled = true;

    try {
        const typeDoc = document.getElementById('doc_type_title').innerText;
        
        // CORRECTION MAJEURE ICI : on lit bien tous les champs, y compris la civilité
        const data = {
            type: typeDoc,
            date_creation: new Date().toISOString(),
            date_document: document.getElementById('facture_date').value,
            client: {
                civility: document.getElementById('client_civility').value,
                nom: document.getElementById('client_nom').value,
                adresse: document.getElementById('client_adresse').value,
                cp: document.getElementById('client_cp').value,
                ville: document.getElementById('client_ville').value
            },
            defunt: {
                civility: document.getElementById('defunt_civility').value, // C'était le bug !
                nom: document.getElementById('defunt_nom').value,
                date_deces: document.getElementById('defunt_date_deces').value,
                ville_deces: document.getElementById('defunt_ville_deces').value
            },
            lignes: lignesFacture,
            total_ttc: parseFloat(document.getElementById('total_ttc').innerText.replace(' €',''))
        };

        if(currentFactureId) {
            await updateDoc(doc(db, "factures_v2", currentFactureId), data);
            alert("Modifications enregistrées !");
        } else {
            // Génération d'un numéro simple (Timestamp pour l'instant)
            data.info = { numero: typeDoc.charAt(0) + "-" + Date.now().toString().slice(-6) };
            const docRef = await addDoc(collection(db, "factures_v2"), data);
            currentFactureId = docRef.id;
            document.getElementById('doc_num').innerText = data.info.numero;
            alert("Document créé avec succès !");
        }
    } catch(e) {
        console.error(e);
        alert("Erreur sauvegarde : " + e.message);
    }
    btn.innerHTML = '<i class="fas fa-save"></i> ENREGISTRER';
    btn.disabled = false;
};

window.chargerHistoriqueFactures = async function() {
    const tbody = document.getElementById('history-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Chargement...</td></tr>';

    try {
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"));
        const snaps = await getDocs(q);
        
        tbody.innerHTML = "";
        snaps.forEach(docSnap => {
            const d = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(d.date_document).toLocaleDateString()}</td>
                <td><strong>${d.info?.numero || 'BROUILLON'}</strong></td>
                <td>${d.client?.nom || 'Inconnu'}<br><small style="color:#666">Defunt: ${d.defunt?.nom || '-'}</small></td>
                <td style="font-weight:bold;">${d.total_ttc?.toFixed(2)} €</td>
                <td><span class="badge badge-blue">${d.type}</span></td>
                <td style="text-align:right;">
                    <button class="btn-icon" onclick="window.chargerFacture('${docSnap.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon" onclick="window.supprimerFacture('${docSnap.id}')" style="color:red;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error(e);
        tbody.innerHTML = "";
    }
};

window.chargerFacture = async function(id) {
    currentFactureId = id;
    const docSnap = await getDoc(doc(db, "factures_v2", id));
    if(docSnap.exists()) {
        const d = docSnap.data();
        
        // Bascule vers l'éditeur
        document.getElementById('liste-factures-container').classList.add('hidden');
        document.getElementById('editeur-facture').classList.remove('hidden');
        
        // Remplissage
        document.getElementById('doc_type_title').innerText = d.type;
        document.getElementById('doc_num').innerText = d.info?.numero;
        document.getElementById('facture_date').value = d.date_document;
        
        document.getElementById('client_civility').value = d.client?.civility || "M.";
        document.getElementById('client_nom').value = d.client?.nom || "";
        document.getElementById('client_adresse').value = d.client?.adresse || "";
        document.getElementById('client_cp').value = d.client?.cp || "";
        document.getElementById('client_ville').value = d.client?.ville || "";
        
        document.getElementById('defunt_civility').value = d.defunt?.civility || "M.";
        document.getElementById('defunt_nom').value = d.defunt?.nom || "";
        document.getElementById('defunt_date_deces').value = d.defunt?.date_deces || "";
        document.getElementById('defunt_ville_deces').value = d.defunt?.ville_deces || "";
        
        lignesFacture = d.lignes || [];
        window.renderLignes();
    }
};

window.supprimerFacture = async function(id) {
    if(confirm("Supprimer ce document ?")) {
        await deleteDoc(doc(db, "factures_v2", id));
        window.chargerHistoriqueFactures();
    }
};
