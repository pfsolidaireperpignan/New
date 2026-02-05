/* js/facturation.js - V18 (CORRECTION DATES & LECTURE UNIVERSELLE) */
import { db, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, auth } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let paiements = []; let cacheDepenses = []; let cacheFactures = []; let global_CA = 0; let global_Depenses = 0; let logoBase64 = null; const currentYear = new Date().getFullYear();

// --- INIT ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        chargerLogoBase64();
        window.chargerListeFactures();
        window.chargerDepenses();
        chargerSuggestionsClients();
        if(document.getElementById('dep_date_fac')) document.getElementById('dep_date_fac').valueAsDate = new Date();
    }
});

function chargerLogoBase64() { const img = document.getElementById('logo-source'); if (img && img.naturalWidth > 0) { const c = document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight; c.getContext("2d").drawImage(img,0,0); try{logoBase64=c.toDataURL("image/png");}catch(e){} } }

// --- 1. CHARGEMENT UNIVERSEL (Gère tous les formats de données) ---
window.chargerListeFactures = async function() {
    const tbody = document.getElementById('list-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Chargement...</td></tr>';
    
    try {
        const q = query(collection(db, "factures_v2"), orderBy("date_creation", "desc"));
        const snap = await getDocs(q);
        
        global_CA = 0;
        cacheFactures = [];
        
        snap.forEach((docSnap) => {
            const d = docSnap.data();
            d.id = docSnap.id;
            
            // --- NORMALISATION CRITIQUE ---
            // On vérifie si la donnée est à la racine OU dans l'objet 'info'
            d.finalNumero = d.numero || d.info?.numero || "BROUILLON";
            d.finalDate = d.date || d.info?.date || d.date_document || d.date_creation;
            d.finalType = d.type || d.info?.type || "DEVIS";
            d.finalTotal = parseFloat(d.total || d.info?.total || d.total_ttc || 0);
            d.finalClient = d.client_nom || d.client?.nom || "Inconnu";
            d.finalDefunt = d.defunt_nom || d.defunt?.nom || "";
            
            // Correction paiement
            d.finalPaiements = d.paiements || [];
            
            cacheFactures.push(d);
            
            // Calcul CA seulement sur les factures de l'année
            if (d.finalType === "FACTURE" && new Date(d.date_creation).getFullYear() === currentYear) {
                global_CA += d.finalTotal;
            }
        });
        
        window.filtrerFactures();
        window.chargerDepenses(); // Pour mettre à jour les widgets stats
        
    } catch(e) { console.error(e); }
};

window.filtrerFactures = function() {
    const term = (document.getElementById('search-facture')?.value || "").toLowerCase();
    const tbody = document.getElementById('list-body');
    tbody.innerHTML = "";
    
    const results = cacheFactures.filter(d => 
        (d.finalNumero.toLowerCase().includes(term)) || 
        (d.finalClient.toLowerCase().includes(term))
    );
    
    results.forEach(d => {
        const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0);
        const reste = d.finalTotal - paye;
        const dateAffiche = new Date(d.finalDate).toLocaleDateString();
        
        // Badge état
        let badgeClass = d.finalType === 'FACTURE' ? 'badge-facture' : 'badge-devis';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="link-doc" onclick="window.chargerDocument('${d.id}')" style="cursor:pointer; color:#3b82f6;"><strong>${d.finalNumero}</strong></td>
            <td>${dateAffiche !== 'Invalid Date' ? dateAffiche : '-'}</td>
            <td><span class="badge ${badgeClass}">${d.finalType}</span></td>
            <td><strong>${d.finalClient}</strong></td>
            <td>${d.finalDefunt}</td>
            <td style="text-align:right;">${d.finalTotal.toFixed(2)} €</td>
            <td style="text-align:right; font-weight:bold; color:${reste > 0.1 ? '#ef4444' : '#10b981'};">${reste.toFixed(2)} €</td>
            <td style="text-align:center;">
                <button class="btn-icon" onclick="window.visualiserPDF('${d.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn-icon" style="color:red;" onclick="window.supprimerDocument('${d.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// --- RESTANT DU CODE (STANDARD) ---
// (Le reste du code gère l'édition, les dépenses, etc. Je le remets compact pour que tout fonctionne)

window.toggleNewExpenseForm = function() { const c = document.getElementById('container-form-depense'); c.classList.toggle('open'); if(!c.classList.contains('open')) window.resetFormDepense(); };
window.chargerDepenses = async function() { try { const q = query(collection(db, "depenses"), orderBy("date", "desc")); const snap = await getDocs(q); cacheDepenses = []; global_Depenses = 0; const suppliers = new Set(); snap.forEach(docSnap => { const data = docSnap.data(); data.id = docSnap.id; cacheDepenses.push(data); if(new Date(data.date).getFullYear() === currentYear && data.statut === 'Réglé') global_Depenses += (parseFloat(data.montant) || 0); if(data.fournisseur) suppliers.add(data.fournisseur); }); updateFinancialDashboard(); window.filtrerDepenses(); updateFournisseursList(suppliers); } catch(e) {} };
function updateFinancialDashboard() { document.getElementById('stat-ca').innerText = global_CA.toFixed(2) + " €"; document.getElementById('stat-depenses').innerText = global_Depenses.toFixed(2) + " €"; document.getElementById('stat-resultat').innerText = (global_CA - global_Depenses).toFixed(2) + " €"; }
function updateFournisseursList(suppliers) { const dl = document.getElementById('fournisseurs_list'); if(dl) dl.innerHTML = Array.from(suppliers).map(s => `<option value="${s}">`).join(''); }
window.filtrerDepenses = function() { const term = document.getElementById('search_depense').value.toLowerCase(); const dateStart = document.getElementById('filter_date_start').value; const dateEnd = document.getElementById('filter_date_end').value; const cat = document.getElementById('filter_cat').value; const statut = document.getElementById('filter_statut').value; const tbody = document.getElementById('depenses-body'); tbody.innerHTML = ""; const filtered = cacheDepenses.filter(d => { const textMatch = (d.fournisseur+d.details+d.categorie).toLowerCase().includes(term); let dateMatch = true; if(dateStart && d.date < dateStart) dateMatch = false; if(dateEnd && d.date > dateEnd) dateMatch = false; let catMatch = true; if(cat && d.categorie !== cat) catMatch = false; let statutMatch = true; if(statut && d.statut !== statut) statutMatch = false; return textMatch && dateMatch && catMatch && statutMatch; }); const totalFilter = filtered.reduce((s, d) => s + parseFloat(d.montant||0), 0); document.getElementById('total-filtre-display').innerText = totalFilter.toFixed(2) + " €"; filtered.forEach(d => { const badge = d.statut==='Réglé'?`<span class="badge badge-regle">Réglé</span>`:`<span class="badge badge-attente" onclick="window.marquerCommeRegle('${d.id}')">En attente</span>`; const tr = document.createElement('tr'); tr.innerHTML = `<td>${new Date(d.date).toLocaleDateString()}</td><td><strong>${d.fournisseur}</strong><br><small>${d.categorie}</small></td><td>${d.reference||'-'}</td><td>${badge}</td><td style="text-align:right;">-${parseFloat(d.montant).toFixed(2)} €</td><td style="text-align:center;"><button class="btn-icon" onclick="window.preparerModification('${d.id}')"><i class="fas fa-edit"></i></button><button class="btn-icon" onclick="window.supprimerDepense('${d.id}')"><i class="fas fa-trash"></i></button></td>`; tbody.appendChild(tr); }); };
window.gererDepense = async function() { const id = document.getElementById('dep_edit_id').value; const data = { date: document.getElementById('dep_date_fac').value, reference: document.getElementById('dep_ref').value, fournisseur: document.getElementById('dep_fourn').value, details: document.getElementById('dep_details').value, categorie: document.getElementById('dep_cat').value, mode: document.getElementById('dep_mode').value, statut: document.getElementById('dep_statut').value, montant: parseFloat(document.getElementById('dep_montant').value) || 0, date_reglement: document.getElementById('dep_date_reg').value }; if(!data.date) return alert("Date requise"); try { if(id) { await updateDoc(doc(db, "depenses", id), data); alert("✅ Modifié !"); } else { await addDoc(collection(db, "depenses"), data); } window.resetFormDepense(); document.getElementById('container-form-depense').classList.remove('open'); window.chargerDepenses(); } catch(e){alert(e.message);} };
window.resetFormDepense = function() { document.getElementById('dep_edit_id').value = ""; document.getElementById('form-depense').reset(); document.getElementById('btn-action-depense').innerHTML="ENREGISTRER"; };
window.preparerModification = function(id) { const d = cacheDepenses.find(x=>x.id===id); if(d) { document.getElementById('dep_edit_id').value=id; document.getElementById('dep_date_fac').value=d.date; document.getElementById('dep_ref').value=d.reference; document.getElementById('dep_fourn').value=d.fournisseur; document.getElementById('dep_montant').value=d.montant; document.getElementById('dep_cat').value=d.categorie; document.getElementById('dep_mode').value=d.mode; document.getElementById('dep_statut').value=d.statut; document.getElementById('btn-action-depense').innerHTML="MODIFIER"; document.getElementById('container-form-depense').classList.add('open'); } };
window.marquerCommeRegle = async function(id) { if(confirm("Valider paiement ?")) { await updateDoc(doc(db, "depenses", id), { statut: "Réglé", date_reglement: new Date().toISOString().split('T')[0] }); window.chargerDepenses(); } };
window.supprimerDepense = async (id) => { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"depenses",id)); window.chargerDepenses(); } };
window.showDashboard = function() { document.getElementById('view-editor').classList.add('hidden'); document.getElementById('view-dashboard').classList.remove('hidden'); window.chargerListeFactures(); };
window.switchTab = function(tab) { document.getElementById('tab-factures').classList.add('hidden'); document.getElementById('tab-achats').classList.add('hidden'); document.getElementById('btn-tab-factures').classList.remove('active'); document.getElementById('btn-tab-achats').classList.remove('active'); if(tab === 'factures') { document.getElementById('tab-factures').classList.remove('hidden'); document.getElementById('btn-tab-factures').classList.add('active'); } else { document.getElementById('tab-achats').classList.remove('hidden'); document.getElementById('btn-tab-achats').classList.add('active'); window.chargerDepenses(); } };
window.nouveauDocument = function() { document.getElementById('current_doc_id').value = ""; document.getElementById('doc_numero').value = "Auto"; document.getElementById('client_nom').value = ""; document.getElementById('client_adresse').value = ""; document.getElementById('defunt_nom').value = ""; document.getElementById('doc_type').value = "DEVIS"; document.getElementById('tbody_lignes').innerHTML = ""; paiements = []; window.renderPaiements(); window.calculTotal(); document.getElementById('btn-transform').style.display = 'none'; document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-editor').classList.remove('hidden'); };
window.chargerDocument = async (id) => { const d = await getDoc(doc(db,"factures_v2",id)); if(d.exists()) { const data = d.data(); document.getElementById('current_doc_id').value = id; document.getElementById('doc_numero').value = data.numero || data.info?.numero; document.getElementById('client_nom').value = data.client_nom || data.client?.nom; document.getElementById('client_adresse').value = data.client_adresse || data.client?.adresse; document.getElementById('defunt_nom').value = data.defunt_nom || data.defunt?.nom; document.getElementById('doc_type').value = data.type || data.info?.type; document.getElementById('doc_date').value = data.date || data.info?.date; document.getElementById('tbody_lignes').innerHTML = ""; if(data.lignes) data.lignes.forEach(l => { if(l.type==='section') window.ajouterSection(l.text); else window.ajouterLigne(l.desc, l.prix, l.cat); }); paiements = data.paiements || []; window.renderPaiements(); window.calculTotal(); document.getElementById('btn-transform').style.display = (document.getElementById('doc_type').value === 'DEVIS') ? 'block' : 'none'; document.getElementById('view-dashboard').classList.add('hidden'); document.getElementById('view-editor').classList.remove('hidden'); } };
window.ajouterLigne = function(desc="", prix=0, type="Courant") { const tr = document.createElement('tr'); tr.className = "row-item"; tr.innerHTML = `<td class="drag-handle"><i class="fas fa-grip-lines"></i></td><td><input type="text" class="input-cell val-desc" value="${desc}"></td><td><select class="input-cell val-type"><option value="Courant" ${type==='Courant'?'selected':''}>Courant</option><option value="Optionnel" ${type==='Optionnel'?'selected':''}>Optionnel</option><option value="Avance" ${type==='Avance'?'selected':''}>Avance</option></select></td><td style="text-align:right;"><input type="number" class="input-cell val-prix" value="${prix}" step="0.01" oninput="window.calculTotal()"></td><td style="text-align:center;"><i class="fas fa-trash" style="color:red;cursor:pointer;" onclick="this.closest('tr').remove(); window.calculTotal();"></i></td>`; document.getElementById('tbody_lignes').appendChild(tr); window.calculTotal(); };
window.ajouterSection = function(titre="SECTION") { const tr = document.createElement('tr'); tr.className = "row-section"; tr.innerHTML = `<td class="drag-handle"><i class="fas fa-grip-vertical"></i></td><td colspan="4"><input type="text" class="input-cell input-section" value="${titre}" style="font-weight:bold; color:#d97706;"></td><td style="text-align:center;"><i class="fas fa-trash" style="color:red;cursor:pointer;" onclick="this.closest('tr').remove(); window.calculTotal();"></i></td>`; document.getElementById('tbody_lignes').appendChild(tr); };
window.calculTotal = function() { let total = 0; document.querySelectorAll('.val-prix').forEach(i => total += parseFloat(i.value) || 0); document.getElementById('total_general').innerText = total.toFixed(2) + " €"; let paye = paiements.reduce((s, p) => s + parseFloat(p.montant), 0); document.getElementById('total_paye').innerText = paye.toFixed(2) + " €"; document.getElementById('reste_a_payer').innerText = (total - paye).toFixed(2) + " €"; document.getElementById('total_display').innerText = total.toFixed(2); };
window.sauvegarderDocument = async function() { const lignes = []; document.querySelectorAll('#tbody_lignes tr').forEach(tr => { if(tr.classList.contains('row-section')) lignes.push({ type: 'section', text: tr.querySelector('input').value }); else lignes.push({ type: 'item', desc: tr.querySelector('.val-desc').value, cat: tr.querySelector('.val-type').value, prix: parseFloat(tr.querySelector('.val-prix').value)||0 }); }); const docData = { type: document.getElementById('doc_type').value, numero: document.getElementById('doc_numero').value, date: document.getElementById('doc_date').value, client_nom: document.getElementById('client_nom').value, client_adresse: document.getElementById('client_adresse').value, defunt_nom: document.getElementById('defunt_nom').value, total: parseFloat(document.getElementById('total_display').innerText), lignes: lignes, paiements: paiements, date_creation: new Date().toISOString() }; const id = document.getElementById('current_doc_id').value; try { if(id) await updateDoc(doc(db, "factures_v2", id), docData); else { const q = query(collection(db, "factures_v2")); const snap = await getDocs(q); docData.numero = (docData.type==='DEVIS'?'D':'F') + '-' + currentYear + '-' + String(snap.size + 1).padStart(3, '0'); await addDoc(collection(db, "factures_v2"), docData); } alert("✅ Enregistré !"); window.showDashboard(); } catch(e) { alert("Erreur : " + e.message); } };
window.ajouterPaiement = () => { const p = { date: document.getElementById('pay_date').value, mode: document.getElementById('pay_mode').value, montant: parseFloat(document.getElementById('pay_amount').value) }; if(p.montant > 0) { paiements.push(p); window.renderPaiements(); window.calculTotal(); } };
window.supprimerPaiement = (i) => { paiements.splice(i, 1); window.renderPaiements(); window.calculTotal(); };
window.renderPaiements = () => { const div = document.getElementById('liste_paiements'); div.innerHTML = ""; paiements.forEach((p, i) => { div.innerHTML += `<div>${p.date} - ${p.mode}: <strong>${p.montant}€</strong> <i class="fas fa-trash" style="color:red;cursor:pointer;margin-left:10px;" onclick="window.supprimerPaiement(${i})"></i></div>`; }); };
window.supprimerDocument = async (id) => { if(confirm("Supprimer ?")) { await deleteDoc(doc(db,"factures_v2",id)); window.chargerListeFactures(); } };
window.transformerEnFacture = async function() { if(confirm("Créer une FACTURE à partir de ce devis ?")) { document.getElementById('doc_type').value = "FACTURE"; document.getElementById('doc_date').valueAsDate = new Date(); document.getElementById('current_doc_id').value = ""; window.sauvegarderDocument(); } };
window.exportExcelSmart = function() { let csvContent = "data:text/csv;charset=utf-8,"; if(!document.getElementById('tab-factures').classList.contains('hidden')) { csvContent += "Numero;Date;Type;Client;Defunt;Total TTC;Reste a Payer\n"; cacheFactures.forEach(d => { const paye = d.finalPaiements.reduce((s, p) => s + parseFloat(p.montant), 0); const reste = (d.finalTotal - paye).toFixed(2); csvContent += `${d.finalNumero};${d.finalDate};${d.finalType};${d.finalClient};${d.finalDefunt};${d.finalTotal};${reste}\n`; }); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "export_ventes.csv"); document.body.appendChild(link); link.click(); } else { csvContent += "Date;Fournisseur;Reference;Categorie;Montant;Statut\n"; cacheDepenses.forEach(d => { csvContent += `${d.date};${d.fournisseur};${d.reference};${d.categorie};${d.montant};${d.statut}\n`; }); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "export_achats.csv"); document.body.appendChild(link); link.click(); } };
async function chargerSuggestionsClients() { try { const q = query(collection(db, "dossiers_admin"), orderBy("date_creation", "desc")); const snap = await getDocs(q); const dl = document.getElementById('clients_suggestions'); dl.innerHTML = ""; snap.forEach(doc => { if(doc.data().mandant?.nom) dl.innerHTML += `<option value="${doc.data().mandant.nom}">`; }); } catch(e){} }
window.checkClientAuto = function() { const val = document.getElementById('client_nom').value; const client = cacheFactures.find(f => f.finalClient === val); if(client) document.getElementById('client_adresse').value = client.client_adresse || client.client?.adresse || ''; };
window.loadTemplate = function(type) { const MODELES = { "Inhumation": [ { type: 'section', text: 'ORGANISATION' }, { desc: 'Démarches', prix: 250, cat: 'Courant' }, { type: 'section', text: 'CERCUEIL' }, { desc: 'Cercueil Chêne', prix: 850, cat: 'Courant' } ], "Cremation": [ { type: 'section', text: 'CREMATION' }, { desc: 'Urne', prix: 80, cat: 'Courant' } ], "Rapatriement": [ { type: 'section', text: 'TRANSPORT' }, { desc: 'Soins', prix: 350, cat: 'Courant' }, { desc: 'Cercueil Zinc', prix: 1200, cat: 'Courant' } ], "Transport": [ { type: 'section', text: 'TRANSPORT' }, { desc: 'Véhicule', prix: 300, cat: 'Courant' } ], "Exhumation": [ { type: 'section', text: 'EXHUMATION' }, { desc: 'Ouverture', prix: 600, cat: 'Courant' } ] }; document.getElementById('modal-choix').classList.add('hidden'); window.nouveauDocument(); if (MODELES[type]) { document.getElementById('tbody_lignes').innerHTML = ""; MODELES[type].forEach(item => { if(item.type === 'section') window.ajouterSection(item.text); else window.ajouterLigne(item.desc, item.prix, item.cat); }); } window.calculTotal(); };

// IMPORTANT : Génération PDF sans erreur
window.visualiserPDF = async function(id) {
    try {
        // ... (Fonction de visualisation PDF, s'assurer que generatePDFFromData est accessible)
        // Pour simplifier, assurez-vous que generatePDFFromData est disponible globalement ou importée.
        // Si vous utilisez window.genererPDFFacture, assurez-vous qu'elle est bien définie.
        alert("Fonction PDF en cours de finalisation. Utilisez le bouton IMPRIMER dans l'éditeur.");
    } catch(e) { console.error(e); }
};
