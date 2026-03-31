/* js/pdf_admin.js - VERSION CORRIGÉE ET DYNAMIQUE */

window.logoBase64 = null;

window.chargerLogoBase64 = function() {
    const img = document.getElementById('logo-source');
    if (!img || img.naturalWidth <= 0) return;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    try {
        c.getContext("2d").drawImage(img, 0, 0);
        window.logoBase64 = c.toDataURL("image/png");
    } catch (e) {}
};

/** Attend que logo.png soit chargé (sinon filigrane vide si clic trop tôt ou fichier manquant). */
window.ensureLogoReady = function() {
    return new Promise((resolve) => {
        const img = document.getElementById('logo-source');
        if (!img) { resolve(); return; }
        const finish = () => {
            window.chargerLogoBase64();
            resolve();
        };
        if (img.complete && img.naturalWidth > 0) { finish(); return; }
        const t = setTimeout(finish, 10000);
        img.onload = () => { clearTimeout(t); finish(); };
        img.onerror = () => { clearTimeout(t); resolve(); };
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const img = document.getElementById('logo-source');
        if (img) {
            img.addEventListener('load', window.chargerLogoBase64, { once: true });
            window.chargerLogoBase64();
        }
    });
} else {
    const img = document.getElementById('logo-source');
    if (img) {
        img.addEventListener('load', window.chargerLogoBase64, { once: true });
        window.chargerLogoBase64();
    }
}

// --- UTILITAIRES ---

function ajouterFiligrane(pdf) {
    if (window.logoBase64) {
        try {
            pdf.saveGraphicsState();
            pdf.setGState(new pdf.GState({ opacity: 0.09 }));
            pdf.addImage(window.logoBase64, 'PNG', 55, 98, 100, 100);
            pdf.restoreGraphicsState();
        } catch (e) {}
    }
}

function headerPF(pdf, y=20) {
    pdf.setFont("helvetica","bold"); pdf.setTextColor(34,155,76); pdf.setFontSize(12);
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN",105,y,{align:"center"});
    pdf.setTextColor(80); pdf.setFontSize(8); pdf.setFont("helvetica","normal");
    pdf.text("32 boulevard Léon Jean Grégory Thuir - TEL : 07.55.18.27.77",105,y+5,{align:"center"});
    pdf.text("HABILITATION N° : 23-66-0205 | SIRET : 53927029800042",105,y+9,{align:"center"});
    pdf.setDrawColor(34,155,76); pdf.setLineWidth(0.5); pdf.line(40,y+12,170,y+12);
}

function getVal(id) { return document.getElementById(id) ? document.getElementById(id).value : ""; }

function formatDate(d) { 
    if (!d) return "....................";
    if (d.includes("-")) return d.split("-").reverse().join("/");
    return d; 
}

// --- GESTION INTELLIGENTE DE LA DATE DE NAISSANCE ---
function getTexteNaissance() {
    const chk = document.getElementById('chk_sans_jour_mois');
    if (chk && chk.checked) {
        const annee = getVal("annee_naiss") || "........";
        return "en " + annee;
    }
    return "le " + formatDate(getVal("date_naiss"));
}

function getValNaissanceSeule() {
    const chk = document.getElementById('chk_sans_jour_mois');
    if (chk && chk.checked) return getVal("annee_naiss") || "........";
    return formatDate(getVal("date_naiss"));
}


// --- FONCTIONS DOCUMENTS ---

window.genererPouvoir = async function() {
    await window.ensureLogoReady();
    if (!window.logoBase64) window.chargerLogoBase64();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    ajouterFiligrane(pdf);
    headerPF(pdf);

    const x = 22;
    const w = 166;
    const lineH = 5;

    let typePresta = document.getElementById('prestation').value.toUpperCase();
    if (typePresta === "RAPATRIEMENT") typePresta += ` vers ${getVal("rap_pays").toUpperCase()}`;

    pdf.setFillColor(52, 73, 94);
    pdf.rect(0, 35, 210, 14, 'F');
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text("POUVOIR", 105, 44, { align: "center" });
    pdf.setTextColor(0);

    let y = 56;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    const telMandant = (getVal("tel_mandant") || "").trim();
    const mandStep = 6;
    const mandLineCount = 4 + (telMandant ? 1 : 0);
    const mandBoxH = 8 + mandLineCount * mandStep;
    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, w, mandBoxH, 'FD');
    let ty = y + 5;
    pdf.text(`Je soussigné(e) : ${getVal("civilite_mandant")} ${getVal("soussigne")}`, x + 4, ty);
    ty += mandStep;
    pdf.text(`Demeurant à : ${getVal("demeurant")}`, x + 4, ty);
    ty += mandStep;
    if (telMandant) {
        pdf.text(`Téléphone : ${telMandant}`, x + 4, ty);
        ty += mandStep;
    }
    pdf.text(`Agissant en qualité de : ${getVal("lien")}`, x + 4, ty);
    y += mandBoxH + 6;

    const phraseQualite = "Ayant qualité pour pourvoir aux funérailles de :";
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(phraseQualite, x, y);
    const uY = y + 0.8;
    const uW = pdf.getTextWidth(phraseQualite);
    pdf.setDrawColor(40);
    pdf.setLineWidth(0.35);
    pdf.line(x, uY, x + uW, uY);
    y += lineH + 2;

    const pourStr = `POUR : ${typePresta}`.toUpperCase();
    const domWrap = pdf.splitTextToSize(`Domicile : ${getVal("adresse_fr")}`, w - 8);
    const pourLines = pdf.splitTextToSize(pourStr, w - 16);
    const defStep = 6;
    const yName = y + 5;
    const yNe = yName + defStep;
    const yDec = yNe + defStep;
    const domStartY = yDec + defStep;
    const lastDomBaseline = domStartY + (domWrap.length - 1) * lineH;
    const pourStartY = lastDomBaseline + 6;
    const pourBlockH = Math.max(lineH, (pourLines.length - 1) * lineH + lineH);
    const defBoxH = pourStartY + pourBlockH + 4 - y;

    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(250, 250, 252);
    pdf.setLineWidth(0.5);
    pdf.rect(x, y, w, defBoxH, "FD");

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(
        `Défunt(e) ${getVal("civilite_defunt")} ${getVal("nom")} ${getVal("prenom")}`,
        x + 4,
        yName
    );
    pdf.setFont("helvetica", "normal");
    pdf.text(`Né(e) le : ${getTexteNaissance()} à ${getVal("lieu_naiss")}`, x + 4, yNe);

    const decLabel = "Décédé(e) le : ";
    pdf.text(decLabel, x + 4, yDec);
    pdf.setFont("helvetica", "bold");
    pdf.text(
        `${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`,
        x + 4 + pdf.getTextWidth(decLabel),
        yDec
    );
    pdf.setFont("helvetica", "normal");
    domWrap.forEach((ln, i) => {
        pdf.text(ln, x + 4, domStartY + i * lineH);
    });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(211, 47, 47);
    let py = pourStartY;
    pourLines.forEach((ln) => {
        pdf.text(ln, 105, py, { align: "center" });
        py += lineH;
    });
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    y += defBoxH + 8;

    pdf.setFont("helvetica", "bold");
    pdf.text("Donne mandat aux PF SOLIDAIRE PERPIGNAN pour :", x, y);
    y += lineH + 2;
    pdf.setFont("helvetica", "normal");
    pdf.text("- Effectuer toutes les démarches administratives.", x + 4, y);
    y += lineH + 1;
    if (typePresta.includes("TRANSPORT")) {
        pdf.text("- Effectuer le transport de corps.", x + 4, y);
        y += lineH + 1;
    } else {
        pdf.text("- Signer toute demande d'autorisation nécessaire.", x + 4, y);
        y += lineH + 1;
        if (typePresta.includes("RAPATRIEMENT")) {
            pdf.text("- Accomplir les formalités consulaires.", x + 4, y);
            y += lineH + 1;
        }
    }

    y += 6;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, x, y);
    y += 14;

    if (y > 248) {
        pdf.addPage();
        y = 30;
    }

    pdf.setDrawColor(0);
    pdf.setLineWidth(1);
    pdf.line(20, y, 190, y);
    y += 9;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature du Mandant", 55, y);
    pdf.text("Cachet / Visa PF Solidaire", 150, y);

    pdf.save(`Pouvoir_${getVal("nom")}.pdf`);
};

window.genererDemandeRapatriement = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    
    pdf.setDrawColor(0); pdf.setLineWidth(0.5); pdf.setFillColor(240, 240, 240);
    pdf.rect(15, 15, 180, 25, 'FD'); 
    pdf.setTextColor(0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14);
    pdf.text("DEMANDE D'AUTORISATION DE TRANSPORT DE CORPS", 105, 28, {align:"center"});
    
    let y = 55; const x = 15;
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text("Je soussigné(e) (nom et prénom) : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text("CHERKAOUI MUSTAPHA", x+60, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text("Représentant légal de : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text("Pompes Funèbres Solidaire Perpignan, 32 Bd Léon Jean Grégory Thuir", x+40, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text("Habilitée sous le n° : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text("23-66-0205", x+35, y); y+=6;
    
    pdf.setFont("helvetica", "normal"); 
    pdf.text("Dûment mandaté par la famille de la défunte, sollicite l'autorisation de faire transporter en dehors du", x, y); y+=5;
    pdf.text("territoire métropolitain le corps après mise en bière de :", x, y); y+=10;
    
    pdf.text("Nom et prénom de la défunte : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+55, y); y+=6;
    
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date et lieu de naissance    :  ${getValNaissanceSeule()}`, x, y); 
    pdf.text(`à   ${getVal("lieu_naiss")}`, x+80, y); y+=6;
    pdf.text(`Décédé(e) le                       :  ${formatDate(getVal("date_deces"))}`, x, y); 
    pdf.text(`à   ${getVal("lieu_deces")}`, x+80, y); y+=8;
    
    pdf.setFont("helvetica", "normal"); pdf.text("Fille/Fils de (père) : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(getVal("pere") || "", x+35, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text("et de (mère) : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(getVal("mere") || "", x+35, y); y+=6;
    
    let situation = getVal("matrimoniale"); const conjoint = getVal("conjoint");
    if(conjoint && conjoint.trim() !== "") { 
        if(situation.includes("Veuf")) situation = "Veuve de " + conjoint; 
        else if(situation.includes("Marié")) situation = "Epoux(se) de " + conjoint; 
        else situation = situation + " " + conjoint; 
    }
    pdf.setFont("helvetica", "normal"); pdf.text("Situation familiale : ", x, y); 
    pdf.setFont("helvetica", "bold"); pdf.text(situation, x+35, y); y+=10;
    
    pdf.setFont("helvetica", "bold"); pdf.text("Moyen de transport :", x+5, y); 
    pdf.setLineWidth(0.3); pdf.line(x+5, y+1, x+40, y+1); y+=8;
    
    pdf.rect(x+5, y-3, 2, 2, 'F'); pdf.text("Par voie routière :", x+10, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`> Avec le véhicule funéraire immatriculé : ${getVal("rap_immat")}`, x+15, y); y+=5;
    pdf.text(`> Date et heure de départ le : ${getVal("rap_date_dep_route")}`, x+15, y); y+=5;
    pdf.text(`> Lieu de départ : ${getVal("rap_ville_dep")}`, x+15, y); y+=5;
    pdf.text(`> Commune et pays d'arrivée : ${getVal("rap_ville_arr")}`, x+15, y); y+=8;
    
    pdf.setFont("helvetica", "bold");
    pdf.rect(x+5, y-3, 2, 2, 'F'); pdf.text("Par voie aérienne :", x+10, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`> Numéro de LTA : ${getVal("rap_lta")}`, x+15, y); y+=5;
    if(getVal("vol1_num")) { 
        pdf.text(`- Vol 1 : ${getVal("vol1_num")} (${getVal("vol1_dep_aero")} -> ${getVal("vol1_arr_aero")})`, x+25, y); y+=5; 
        pdf.text(`- Départ : ${getVal("vol1_dep_time")}`, x+25, y); y+=5; 
        pdf.text(`- Arrivée : ${getVal("vol1_arr_time")}`, x+25, y); y+=5; 
    }
    if(document.getElementById('check_vol2')?.checked && getVal("vol2_num")) { 
        pdf.text(`- Vol 2 : ${getVal("vol2_num")} (${getVal("vol2_dep_aero")} -> ${getVal("vol2_arr_aero")})`, x+25, y); y+=5; 
        pdf.text(`- Départ : ${getVal("vol2_dep_time")}`, x+25, y); y+=5; 
        pdf.text(`- Arrivée : ${getVal("vol2_arr_time")}`, x+25, y); y+=5; 
    }
    
    y+=5; pdf.setFont("helvetica", "normal");
    pdf.text(`Lieu d'inhumation du corps (Ville – Pays) : `, x, y);
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("rap_ville")} (${getVal("rap_pays")})`, x+70, y); y+=20;
    
    pdf.setFont("helvetica", "normal");
    pdf.text(`Fait à : ${getVal("faita")}`, 130, y); y+=6;
    pdf.text(`Le : ${formatDate(getVal("dateSignature"))}`, 130, y); y+=10;
    pdf.setFont("helvetica", "bold"); pdf.text("Signature et cachet :", 130, y);
    
    pdf.save(`Demande_Rapatriement_Prefecture_${getVal("nom")}.pdf`);
};

/**
 * Attestation de conformité du cercueil — texte officiel, champs issus du formulaire (Rapatriement).
 */
window.genererAttestationConformiteCercueil = async function() {
    if (document.getElementById("prestation")?.value !== "Rapatriement") {
        alert("⚠️ Ce document est prévu lorsque la prestation « Rapatriement » est sélectionnée.");
        return;
    }
    await window.ensureLogoReady();
    if (!window.logoBase64) window.chargerLogoBase64();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    ajouterFiligrane(pdf);
    headerPF(pdf);

    const x = 15;
    const w = 180;
    const lh = 4.8;
    let y = 36;
    const ensureSpace = (need) => {
        if (y + need > 278) {
            pdf.addPage();
            ajouterFiligrane(pdf);
            headerPF(pdf, 15);
            y = 28;
        }
    };

    const trajetDepart = () => {
        const t = (getVal("attest_trajet_depart") || "").trim();
        if (t) return t;
        const a = (getVal("vol1_dep_aero") || getVal("rap_ville_dep") || "").trim();
        return a ? `${a}, France` : "……………………";
    };
    const trajetArrivee = () => {
        const t = (getVal("attest_trajet_arrivee") || "").trim();
        if (t) return t;
        const aero =
            (getVal("vol1_arr_aero") || getVal("vol2_arr_aero") || "").trim();
        const p = (getVal("rap_pays") || "").trim();
        if (aero && p) return `${aero}, ${p}`;
        if (aero) return aero;
        const v = (getVal("rap_ville") || "").trim();
        if (v && p) return `${v}, ${p}`;
        return v || p || "……………………";
    };
    const attestOpt = () => {
        const el = document.querySelector('input[name="attest_cercueil_option"]:checked');
        return el ? el.value : "funisorb";
    };
    const mark = (v) => (attestOpt() === v ? "X" : " ");

    const nomDef = `${getVal("civilite_defunt")}. ${getVal("nom").toUpperCase()} ${getVal("prenom")}`;
    const ltaNo = (getVal("rap_lta") || "").trim() || "……………………";

    const titreY = y;
    pdf.setFillColor(52, 73, 94);
    pdf.rect(15, titreY - 2, 180, 14, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text("ATTESTATION DE CONFORMITE DU CERCUEIL", 105, titreY + 7, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    y = titreY + 16;
    pdf.setDrawColor(60);
    pdf.setLineWidth(0.35);
    pdf.line(15, y, 195, y);
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("L'ENTREPRISE DE POMPES FUNEBRES :", x, y);
    y += lh + 1;
    pdf.setFont("helvetica", "normal");
    pdf.text("Pompes Funèbres Solidaire Perpignan", x, y);
    y += lh;
    pdf.text("32 boulevard Léon Jean Grégory Thuir - France", x, y);
    y += lh + 4;

    const p1 = `Atteste avoir procédé à la mise en bière de ${nomDef}`;
    const p1Lines = pdf.splitTextToSize(p1, w);
    ensureSpace(p1Lines.length * lh + 6);
    pdf.text(p1Lines, x, y);
    y += p1Lines.length * lh + 2;

    const p2 = `Pour son transport par avion de ${trajetDepart()} à ${trajetArrivee()}`;
    const p2Lines = pdf.splitTextToSize(p2, w);
    ensureSpace(p2Lines.length * lh + 6);
    pdf.text(p2Lines, x, y);
    y += p2Lines.length * lh + 4;

    pdf.setFont("helvetica", "bold");
    pdf.text(`LTA (AWB) NO. ${ltaNo}`, x, y);
    y += lh + 2;
    pdf.setFont("helvetica", "normal");
    pdf.setDrawColor(120);
    pdf.setLineWidth(0.2);
    pdf.line(x, y, x + w, y);
    y += lh + 2;

    const regIntro =
        "Règlements officiels, en particulier -Décret Ministériel du 31 Décembre 1941, Modifié par celui du 18 Mai 1976 - Arrêté Ministériel du 10 Avril 1961 - qu'aux règlements de la Compagnie aérienne et certifie que toutes précautions ont été prises pour que la qualité de la soudure assure au cercueil l'étanchéité de rigueur et que le cercueil :";
    const regLines = pdf.splitTextToSize(regIntro, w);
    ensureSpace(regLines.length * lh + 8);
    pdf.text(regLines, x, y);
    y += regLines.length * lh + 4;

    const opt1 =
        `(${mark("funisorb")}) SOIT - est muni d'un appareil épurateur et décompresseur FUNISORB agréé par le ministère de la santé et    répondant à la norme SANP 9203149A`;
    const opt2 =
        `(${mark("conservation")})  SOIT - contient un corps ayant reçu des soins de conservation tel que prévu au titre du 1er du Décret  du 31 Décembre 1941, modifié conformément à la réglementation en vigueur.`;
    const opt3 =
        `(${mark("caisse")})  SOIT  - est contenu dans une caisse métallique parfaitement étanche pouvant résister à une pression de 10 Kg/cm.`;

    [opt1, opt2, opt3].forEach((txt) => {
        const lines = pdf.splitTextToSize(txt, w);
        ensureSpace(lines.length * lh + 3);
        pdf.text(lines, x, y);
        y += lines.length * lh + 2;
    });

    y += 2;
    ensureSpace(14);
    pdf.text(`Fait à : ${getVal("faita") || "………………"}       Le : ${formatDate(getVal("dateSignature"))}`, x, y);
    y += lh + 4;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature / Cachet", x, y);
    y += lh + 6;

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.6);
    pdf.line(15, y, 195, y);
    y += lh + 2;

    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8.5);
    const foot = [
        "Réglementation gouvernementale Française (Décret 76-435 du 18.6.1976)",
        "Le responsable de la mise-en-bière doit garantir la parfaite étanchéité du cercueil.",
        "Le cercueil doit obligatoirement être muni d'un dispositif spécial agréé assurant la réduction de la pression et l'épuration des gaz.",
        "Ce dispositif doit pouvoir fonctionner normalement : dans les conditions habituelles de vol et en particulier pendant les montées et descentes ; dans le cas de panne brutale de pressurisation survenant à bord d'un avion."
    ];
    foot.forEach((line) => {
        const fl = pdf.splitTextToSize(line, w);
        ensureSpace(fl.length * lh + 2);
        pdf.text(fl, x, y);
        y += fl.length * lh + 1.5;
    });

    pdf.save(`Attestation_Conformite_Cercueil_${getVal("nom") || "dossier"}.pdf`);
};

window.genererDeclaration = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); const fontMain = "times";
    
    pdf.setFont(fontMain, "bold"); pdf.setFontSize(16);
    pdf.text("DECLARATION DE DECES", 105, 30, { align: "center" });
    pdf.setLineWidth(0.5); pdf.line(75, 31, 135, 31);
    
    pdf.setFontSize(11);
    pdf.text("Dans tous les cas à remettre obligatoirement complété et signé", 105, 38, { align: "center" });
    pdf.line(55, 39, 155, 39);
    
    let y = 60; const margin = 20;
    const drawLine = (label, val, yPos) => {
        pdf.setFont(fontMain, "bold"); pdf.text(label, margin, yPos);
        const startDots = margin + pdf.getTextWidth(label) + 2;
        let curX = startDots; pdf.setFont(fontMain, "normal");
        while(curX < 190) { pdf.text(".", curX, yPos); curX += 2; }
        if(val) { 
            pdf.setFont(fontMain, "bold"); pdf.setFillColor(255, 255, 255); 
            pdf.rect(startDots, yPos - 4, pdf.getTextWidth(val)+5, 5, 'F'); 
            pdf.text(val.toUpperCase(), startDots + 2, yPos); 
        }
    };
    
    drawLine("NOM : ", getVal("nom"), y); y+=14;
    drawLine("NOM DE JEUNE FILLE : ", getVal("nom_jeune_fille"), y); y+=14;
    drawLine("Prénoms : ", getVal("prenom"), y); y+=14;
    
    const labelNaiss = document.getElementById('chk_sans_jour_mois')?.checked ? "Né(e) en : " : "Né(e) le : ";
    drawLine(labelNaiss, getValNaissanceSeule(), y); y+=14;
    drawLine("A : ", getVal("lieu_naiss"), y); y+=14;
    
    pdf.setFont(fontMain, "bold"); pdf.text("DATE ET LIEU DU DECES LE", margin, y);
    pdf.setFont(fontMain, "normal"); pdf.text(formatDate(getVal("date_deces")), margin+70, y);
    pdf.setFont(fontMain, "bold"); pdf.text("A", 120, y); pdf.text(getVal("lieu_deces").toUpperCase(), 130, y); y += 18;
    
    pdf.text("PROFESSION : ", margin, y); y+=8;
    const prof = getVal("prof_type"); pdf.setFont(fontMain, "normal");
    pdf.rect(margin+5, y-4, 5, 5); if(prof === "Sans profession") pdf.text("X", margin+6, y); pdf.text("Sans profession", margin+15, y);
    pdf.rect(margin+60, y-4, 5, 5); if(prof === "Retraité(e)") pdf.text("X", margin+61, y); pdf.text("retraité(e)", margin+70, y);
    if(prof === "Active") { 
        const metier = getVal("profession_libelle") || "Active"; 
        pdf.setFont(fontMain, "bold"); pdf.text(metier.toUpperCase(), margin+110, y); 
    }
    y += 15;
    
    drawLine("DOMICILIE(E) ", getVal("adresse_fr"), y); y+=14;
    drawLine("FILS OU FILLE de (Père) :", getVal("pere"), y); y+=14;
    drawLine("Et de (Mère) :", getVal("mere"), y); y+=14;
    
    let situation = getVal("matrimoniale"); const nomConjoint = getVal("conjoint");
    if (nomConjoint && nomConjoint.trim() !== "") { 
        if (situation.includes("Marié")) situation = `MARIÉ(E) À ${nomConjoint}`; 
        else if (situation.includes("Veuf")) situation = `VEUF(VE) DE ${nomConjoint}`; 
        else if (situation.includes("Divorcé")) situation = `DIVORCÉ(E) DE ${nomConjoint}`; 
    }
    drawLine("Situation Matrimoniale : ", situation, y); y+=14;
    drawLine("NATIONALITE : ", getVal("nationalite"), y); y+=25;
    
    pdf.setFont(fontMain, "bold"); pdf.text("NOM ET SIGNATURE DES POMPES FUNEBRES", 105, y, { align: "center" });
    
    pdf.save(`Declaration_Deces_${getVal("nom")}.pdf`);
};

window.genererDemandeInhumation = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); const { jsPDF } = window.jspdf; const pdf = new jsPDF(); headerPF(pdf);
    pdf.setFillColor(230, 240, 230); pdf.rect(20, 40, 170, 10, 'F');
    pdf.setFontSize(14); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
    pdf.text("DEMANDE D'INHUMATION", 105, 47, { align: "center" });
    let y = 70; const x = 25;
    pdf.setFontSize(11); pdf.text("Monsieur le Maire,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("Je soussigné M. CHERKAOUI Mustapha, dirigeant des PF Solidaire,", x, y); y+=6;
    pdf.text("Sollicite l'autorisation d'inhumer le défunt :", x, y); y+=12;
    pdf.setFont("helvetica", "bold"); pdf.text(`${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+10, y); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.text(`Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x+10, y); y+=15;
    pdf.text("Lieu d'inhumation :", x, y); y+=6;
    pdf.setFont("helvetica", "bold"); pdf.text(`Cimetière : ${getVal("cimetiere_nom")}`, x+10, y); y+=6;
    pdf.text(`Le : ${formatDate(getVal("date_inhumation"))} à ${getVal("heure_inhumation")}`, x+10, y); y+=6;
    pdf.text(`Concession : ${getVal("num_concession")} (${getVal("type_sepulture")})`, x+10, y); y+=20;
    pdf.setFont("helvetica", "normal"); pdf.text("Veuillez agréer, Monsieur le Maire, mes salutations distinguées.", x, y); y+=20;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 130, y);
    pdf.save(`Demande_Inhumation_${getVal("nom")}.pdf`);
};

window.genererDemandeCremation = function() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); headerPF(pdf);
    pdf.setFont("times", "bold"); pdf.setFontSize(12);
    pdf.text(`${getVal("civilite_mandant")} ${getVal("soussigne")}`, 20, 45); 
    pdf.setFont("times", "normal"); pdf.text(getVal("demeurant"), 20, 51);
    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("Monsieur le Maire", 150, 60, {align:"center"});
    pdf.setFontSize(12); pdf.text("OBJET : DEMANDE D'AUTORISATION DE CREMATION", 20, 80);
    let y = 100;
    pdf.setFont("times", "normal");
    const txt = `Monsieur le Maire,\n\nJe soussigné(e) ${getVal("civilite_mandant")} ${getVal("soussigne")}, agissant en qualité de ${getVal("lien")} du défunt(e), sollicite l'autorisation de procéder à la crémation de :\n\n${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}\nNé(e) ${getTexteNaissance()} et décédé(e) le ${formatDate(getVal("date_deces"))}.\n\nLa crémation aura lieu le ${formatDate(getVal("date_cremation"))} au ${getVal("crematorium_nom")}.\nDestination des cendres : ${getVal("destination_cendres")}.\n\nJe certifie que le défunt n'était pas porteur d'un stimulateur cardiaque.`;
    const splitTxt = pdf.splitTextToSize(txt, 170); pdf.text(splitTxt, 20, y);
    y += (splitTxt.length * 7) + 20;
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 120, y);
    pdf.setFont("times", "bold"); pdf.text("Signature", 120, y+8);
    pdf.save(`Demande_Cremation_${getVal("nom")}.pdf`);
};

window.genererFermeture = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); 
    ajouterFiligrane(pdf); headerPF(pdf);
    pdf.setFillColor(52, 73, 94); pdf.rect(0, 35, 210, 15, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setTextColor(255, 255, 255);
    pdf.text("DÉCLARATION DE MISE EN BIÈRE, DE FERMETURE", 105, 41, { align: "center" });
    pdf.text("ET DE SCELLEMENT DE CERCUEIL", 105, 47, { align: "center" });
    pdf.setTextColor(0); pdf.setFontSize(10);
    let y = 65; const x = 20;
    pdf.setDrawColor(200); pdf.setLineWidth(0.5); pdf.rect(x, y, 170, 20);
    pdf.setFont("helvetica", "bold"); pdf.text("L'OPÉRATEUR FUNÉRAIRE", x+5, y+5);
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon Jean Grégory, Thuir", x+5, y+10);
    pdf.text("Habilitation : 23-66-0205", x+5, y+15); y += 30;
    pdf.text("Je, soussigné M. CHERKAOUI Mustapha, certifie avoir procédé à la mise en bière,", x, y);
    pdf.text("à la fermeture et au scellement du cercueil.", x, y+5); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text(`DATE : ${formatDate(getVal("date_fermeture"))}`, x, y);
    pdf.text(`LIEU : ${getVal("lieu_mise_biere")}`, x+80, y); y+=15;
    pdf.setFillColor(240, 240, 240); pdf.rect(x, y, 170, 30, 'F');
    pdf.setFont("helvetica", "bold"); pdf.text("IDENTITÉ DU DÉFUNT(E)", x+5, y+6);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Nom : ${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()}`, x+5, y+14); pdf.text(`Prénom : ${getVal("prenom")}`, x+80, y+14);
    
    const prefixNe = document.getElementById('chk_sans_jour_mois')?.checked ? "Né(e) en :" : "Né(e) le :";
    pdf.text(`${prefixNe} ${getValNaissanceSeule()}`, x+5, y+22); 
    pdf.text(`Décédé(e) le : ${formatDate(getVal("date_deces"))}`, x+80, y+22); y+=40;
    
    const typePresence = document.getElementById('type_presence_select').value;
    const isPolice = (typePresence === 'police'); 
    pdf.setFont("helvetica", "bold"); pdf.text("EN PRÉSENCE DE :", x, y); y+=10;
    pdf.setDrawColor(0); pdf.rect(x, y, 170, 30);
    if(isPolice) {
        pdf.text("AUTORITÉ DE POLICE (Absence de famille)", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom & Grade : ${getVal("p_nom_grade")}`, x+5, y+14);
        pdf.text(`Commissariat : ${getVal("p_commissariat")}`, x+5, y+22);
    } else {
        pdf.text("LA FAMILLE (Témoin)", x+5, y+6);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Nom : ${getVal("f_nom_prenom")}`, x+5, y+14);
        pdf.text(`Lien : ${getVal("f_lien")}`, x+80, y+14);
        pdf.text(`Adresse : ${getVal("demeurant")}`, x+5, y+22); 
    }
    y+=45; pdf.line(20, y, 190, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature Opérateur", 40, y);
    pdf.text(isPolice ? "Signature Police" : "Signature Famille", 140, y);
    pdf.save(`PV_Mise_En_Biere_Fermeture_${getVal("nom")}.pdf`);
};

window.genererDemandeOuverture = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); headerPF(pdf); 
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(0);
    pdf.text("DEMANDE D'OUVERTURE D'UNE SEPULTURE DE FAMILLE", 105, 40, { align: "center" });
    let y = 55; const x = 15; 
    pdf.setFontSize(10);
    pdf.text("POUR : ", x, y);
    const type = getVal("prestation");
    pdf.rect(x+20, y-4, 5, 5); 
    if(type === "Inhumation") { pdf.setLineWidth(0.5); pdf.line(x+20, y-4, x+25, y+1); pdf.line(x+25, y-4, x+20, y+1); }
    pdf.text("INHUMATION", x+27, y);
    pdf.rect(x+65, y-4, 5, 5); 
    if(type === "Exhumation") { pdf.setLineWidth(0.5); pdf.line(x+65, y-4, x+70, y+1); pdf.line(x+70, y-4, x+65, y+1); }
    pdf.text("EXHUMATION", x+72, y);
    pdf.rect(x+110, y-4, 5, 5); 
    pdf.text("SCELLEMENT D'URNE", x+117, y);
    y += 15;
    pdf.setFont("helvetica", "normal");
    pdf.text("Nous soussignons :", x, y); y+=6;
    pdf.text("> Nom et Prénom : ", x+5, y); 
    pdf.setFont("helvetica", "bold"); 
    pdf.text(`${getVal("civilite_mandant")} ${getVal("soussigne").toUpperCase()}`, x+40, y);
    pdf.setFont("helvetica", "normal");
    pdf.text("Lien de parenté : ", x+110, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(getVal("lien"), x+140, y);
    y += 12;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x, y-3, 2, 2, 'F'); 
    pdf.text("Demandons à faire :", x+5, y); y+=6;
    let actionTxt = "Ouvrir la concession";
    if(type === "Inhumation") actionTxt = "Inhumer dans la concession";
    if(type === "Exhumation") actionTxt = "Exhumer de la concession";
    pdf.text(`${actionTxt} :`, x+5, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text(`n° ${getVal("num_concession")}`, x+10, y);
    pdf.text(`acquise par : ${getVal("titulaire_concession")}`, x+50, y);
    pdf.text(`(Cimetière : ${getVal("cimetiere_nom")})`, x+130, y);
    y += 12;
    pdf.setFont("helvetica", "bold");
    pdf.rect(x, y-3, 2, 2, 'F');
    pdf.text("Le corps de :", x+5, y); y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text("> M/Mme : ", x+5, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+30, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(`né(e) ${getTexteNaissance()} à ${getVal("lieu_naiss")}`, x+110, y);
    y+=6;
    pdf.text("> Qui demeurait à : ", x+5, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(pdf.splitTextToSize(getVal("adresse_fr"), 130), x+40, y);
    y+=6;
    pdf.setFont("helvetica", "normal");
    pdf.text("> Décédé(e) le : ", x+5, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, x+40, y);
    y += 15;
    pdf.setFont("helvetica", "bold"); 
    pdf.rect(x, y-3, 2, 2, 'F'); 
    pdf.text("Mandatons et donnons pouvoir à l'entreprise :", x+5, y); y+=5;
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, y, {align:"center"}); y+=6;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text("D'exécuter les travaux d'ouverture et fermeture ou scellement d'une urne relatifs à l'opération", x, y); y+=4;
    pdf.text("funéraire ci-dessus mentionnée.", x, y); y+=6;
    pdf.setFontSize(10);
    pdf.text("M : ......................................................", x, y);
    pdf.setFont("helvetica", "bold"); pdf.text("CHERKAOUI MUSTAPHA", x+60, y); y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("Pompes Funèbres à ..............................", x, y);
    pdf.setFont("helvetica", "bold"); pdf.text("32 boulevard Léon Jean Grégory Thuir", x+60, y); 
    y += 15;
    pdf.setFont("helvetica", "bold");
    pdf.text("Date et heure de l'inhumation au cimetière :", x, y); y+=8;
    pdf.setFont("helvetica", "normal");
    pdf.text("......................................................................................", x, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${formatDate(getVal("date_inhumation"))} à ${getVal("heure_inhumation")}`, x+20, y-1);
    y += 15;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    const legal = "La présente déclaration dont j'assure la peine et entière responsabilité m'engage à garantir la ville contre toute réclamation qui pourrait survenir suite à l'inhumation/exhumation ou le scellement d'urne qui en fait objet.\n\nEnfin conférèrent à la réglementation en vigueur je m'engage à fournir la preuve de la qualité du ou des ayants droits (livret de famille, acte de naissance, attestation notariée etc.) et déposer ou service Réglementation funéraire de la ville, la copie du ou des document(s) précité prouvant la qualité du ou des ayants droits.";
    const splitLegal = pdf.splitTextToSize(legal, 180);
    pdf.text(splitLegal, x, y);
    y += 35;
    pdf.setFontSize(11);
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, 130, y); y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Signature des déclarants", 130, y);
    pdf.save(`Ouverture_Sepulture_${getVal("nom")}.pdf`);
};

window.genererTransport = function(type) {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    const prefix = type === 'avant' ? 'av' : 'ap';
    const labelT = type === 'avant' ? "AVANT MISE EN BIÈRE" : "APRÈS MISE EN BIÈRE";
    pdf.setLineWidth(1); pdf.rect(10, 10, 190, 277); headerPF(pdf);
    pdf.setFillColor(200); pdf.rect(10, 35, 190, 15, 'F');
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text(`DÉCLARATION DE TRANSPORT DE CORPS`, 105, 42, { align: "center" });
    pdf.setFontSize(12); pdf.text(labelT, 105, 47, { align: "center" });
    let y = 70; const x = 20;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("TRANSPORTEUR :", x, y); y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("PF SOLIDAIRE PERPIGNAN - 32 Bd Léon J. Grégory, Thuir", x, y); y+=15;
    pdf.setDrawColor(0); pdf.rect(x, y, 170, 30); 
    pdf.setFont("helvetica", "bold"); pdf.text("DÉFUNT(E)", x+5, y+6);
    pdf.setFontSize(14); 
    pdf.text(`${getVal("civilite_defunt")} ${getVal("nom")} ${getVal("prenom")}`, 105, y+15, {align:"center"});
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    const phraseEtatCivil = `Né(e) ${getTexteNaissance()} à ${getVal("lieu_naiss")}    —    Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`;
    pdf.text(phraseEtatCivil, 105, y+22, {align:"center"}); 
    y+=40; 
    pdf.setLineWidth(0.5); 
    pdf.rect(x, y, 80, 50); 
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.text("LIEU DE DÉPART", x+5, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(getVal(`${prefix}_lieu_depart`), x+5, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+5, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatDate(getVal(`${prefix}_date_dep`))} à ${getVal(`${prefix}_heure_dep`)}`, x+5, y+42);
    pdf.rect(x+90, y, 80, 50);
    pdf.setFont("helvetica", "bold"); pdf.text("LIEU D'ARRIVÉE", x+95, y+6);
    pdf.setFont("helvetica", "normal"); pdf.text(getVal(`${prefix}_lieu_arrivee`), x+95, y+15);
    pdf.setFont("helvetica", "bold"); pdf.text("Date & Heure :", x+95, y+35);
    pdf.setFont("helvetica", "normal"); pdf.text(`${formatDate(getVal(`${prefix}_date_arr`))} à ${getVal(`${prefix}_heure_arr`)}`, x+95, y+42);
    y+=60;
    const faita = getVal("faita");
    const dateSign = getVal("dateSignature");
    y += 20; 
    pdf.setFont("helvetica", "normal");
    pdf.text(`Fait à ${faita}, le ${formatDate(dateSign)}`, 120, y);
    pdf.setFont("helvetica", "bold");
    pdf.text("Cachet de l'entreprise :", 120, y+10);
    pdf.save(`Transport_${type}_${getVal("nom")}.pdf`);
};

window.genererDemandeFermetureMairie = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); const { jsPDF } = window.jspdf; const pdf = new jsPDF(); 
    ajouterFiligrane(pdf); headerPF(pdf);
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(34, 155, 76); pdf.setFontSize(16);
    pdf.text("DEMANDE D'AUTORISATION DE FERMETURE", 105, 45, { align: "center" });
    pdf.text("DE CERCUEIL", 105, 53, { align: "center" });
    let y = 80; const x = 25;
    pdf.setTextColor(0); pdf.setFontSize(11); pdf.setFont("helvetica", "bold");
    pdf.text("Je soussigné :", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Nom et Prénom : M. CHERKAOUI Mustapha", x+10, y); y+=8;
    pdf.text("• Qualité : Dirigeant PF Solidaire Perpignan", x+10, y); y+=8;
    pdf.text("• Adresse : 32 Bd Léon Jean Grégory, Thuir", x+10, y); y+=15;
    pdf.setFont("helvetica", "bold");
    pdf.text("A l'honneur de solliciter votre autorisation de fermeture du cercueil de :", x, y); y+=15;
    pdf.setFillColor(245, 245, 245); pdf.rect(x-5, y-5, 170, 35, 'F');
    pdf.text("• Nom et Prénom : " + getVal("civilite_defunt") + " " + getVal("nom").toUpperCase() + " " + getVal("prenom"), x+10, y); y+=10;
    pdf.text(`• Né(e) ${getTexteNaissance()} à ${getVal("lieu_naiss")}`, x+10, y); y+=10;
    pdf.text("• Décédé(e) le : " + formatDate(getVal("date_deces")) + " à " + getVal("lieu_deces"), x+10, y); y+=20;
    pdf.text("Et ce,", x, y); y+=10;
    pdf.setFont("helvetica", "normal");
    pdf.text("• Le : " + formatDate(getVal("date_fermeture")), x+10, y); y+=10;
    pdf.text("• A (Lieu) : " + getVal("lieu_mise_biere"), x+10, y); y+=30;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(getVal("dateSignature"))}`, x, y);
    pdf.save(`Demande_Fermeture_Mairie_${getVal("nom")}.pdf`);
};

// --- CONFIRMATION SEM ---
window.genererConfirmationCremation = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; 
    const pdf = new jsPDF(); 
    
    // Header SEM
    pdf.setFont("times", "bold"); pdf.setFontSize(11);
    pdf.text("SEM CREMATISTE CATALANE", 10, 10);
    pdf.setFont("times", "normal");
    pdf.text("☎ 04 68 51 23 27", 10, 15);
    pdf.text("☎ 04 68 92 49 09 - 06 81 26 34 27", 10, 20);
    pdf.text("Site internet : crematoriumdeperpignan.fr", 10, 25);
    pdf.setLineWidth(0.5); pdf.line(10, 26, 75, 26);

    pdf.setFontSize(8);
    pdf.text("A remplir obligatoirement et en intégralité pour toute demande de crémation", 110, 10);
    pdf.text("A défaut, votre demande de crémation ne sera pas prise en compte", 125, 14);

    pdf.setFont("times", "bold"); pdf.setFontSize(14);
    pdf.text("FICHE DE CONFIRMATION DE CREMATION", 105, 35, {align:"center"});
    pdf.setLineWidth(0.8); pdf.line(55, 36, 155, 36);
    
    pdf.setFontSize(9); pdf.setFont("times", "bold");
    pdf.text("En conformité avec le décret du 19 décembre 2008", 105, 41, {align:"center"});

    pdf.setFontSize(12); pdf.setFont("times", "bold");
    const dateCrem = formatDate(getVal("date_cremation"));
    const heureCrem = getVal("heure_cremation") || "......";
    pdf.text("Date de crémation : ", 35, 50);
    pdf.setFont("times", "normal"); pdf.text(dateCrem, 75, 50);
    
    pdf.setFont("times", "bold"); pdf.text("Heure : ", 130, 50);
    pdf.setFont("times", "normal"); pdf.text(heureCrem, 150, 50);

    const drawSectionTitle = (title, x, y, w) => {
        pdf.setLineWidth(0.8); pdf.setDrawColor(0);
        pdf.rect(x, y, w, 5);
        pdf.setFont("times", "bold"); pdf.setFontSize(10);
        pdf.text(title, x+2, y+3.5);
    };

    let y = 58; const x = 10; const w = 190;

    // DEFUNT
    drawSectionTitle("DEFUNT", x, y, 65);
    y += 5;
    pdf.setLineWidth(0.2); pdf.setLineDash([1, 1], 0); 
    pdf.setFontSize(10); pdf.setFont("times", "bold");
    
    pdf.text("Nom : ", x, y+5); 
    pdf.setFont("times", "normal"); pdf.text(getVal("nom").toUpperCase(), x+15, y+5);
    pdf.text("..................................................................", x+15, y+5); 
    
    pdf.setFont("times", "bold"); pdf.text("Prénom : ", 95, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("prenom"), 115, y+5);
    
    y += 7;
    pdf.setFont("times", "bold"); pdf.text("Date du décès : ", x, y+5);
    pdf.setFont("times", "normal"); pdf.text(formatDate(getVal("date_deces")), x+30, y+5);
    
    pdf.setFont("times", "bold"); pdf.text("Lieu : ", 85, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("lieu_deces"), 98, y+5);
    
    pdf.setFont("times", "bold"); pdf.text("Heures : ", 150, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("heure_deces"), 165, y+5);

    y += 7;
    pdf.setFont("times", "bold"); pdf.text("Lieu de repos du défunt : ", x, y+5);
    const lieuRepos = getVal("lieu_mise_biere") || "Crématorium Public de Perpignan";
    pdf.setFont("times", "normal"); pdf.text(lieuRepos, x+45, y+5);

    y += 7;
    pdf.setFont("times", "bold"); pdf.text("Date de naissance : ", x, y+5);
    pdf.setFont("times", "normal"); pdf.text(getValNaissanceSeule(), x+35, y+5);

    y += 7;
    pdf.setFont("times", "bold"); pdf.text("Domicile : ", x, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("adresse_fr"), x+20, y+5);

    // POUVOIR FAMILLE
    y += 12;
    drawSectionTitle("POUVOIR FAMILLE", x, y, 65);
    y += 5;
    pdf.setFont("times", "bold"); pdf.text("NOM, Prénom : ", x, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("soussigne"), x+30, y+5);
    
    y += 7;
    pdf.setFont("times", "bold"); pdf.text("Lien de parenté : ", x, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("lien"), x+30, y+5);
    
    pdf.setFont("times", "bold"); pdf.text("Téléphone : ", 95, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("tel_mandant"), 118, y+5); 

    y += 7;
    pdf.setFont("times", "bold"); pdf.text("Adresse : ", x, y+5);
    pdf.setFont("times", "normal"); pdf.text(getVal("demeurant"), x+20, y+5);

    // CASIER - SALON
    y += 10;
    drawSectionTitle("CASIER - SALON", x, y, 65);
    y += 8;
    
    const isSalon = document.getElementById('chk_salon').checked;
    
    const box = (lbl, bx, by, checked=false) => { 
        pdf.setLineWidth(0.2); pdf.setLineDash([]); pdf.setDrawColor(0);
        pdf.rect(bx, by-2.5, 3, 3); 
        if(checked) { pdf.setFont("zapfdingbats"); pdf.setFontSize(8); pdf.text("4", bx+0.4, by); }
        pdf.setFont("times", "normal"); pdf.setFontSize(10);
        pdf.text(lbl, bx+5, by); 
    };

    pdf.setFont("times", "bold"); pdf.text("Casier", x, y);
    box("Oui", x+30, y, false); box("Non", x+50, y, true); 

    y += 6;
    pdf.text("Salon", x, y);
    box("Oui", x+30, y, isSalon); box("Non", x+50, y, !isSalon);

    y += 6;
    pdf.text("Salon de présentation", x, y);
    box("Oui", x+45, y, isSalon); box("Non", x+65, y, !isSalon);
    pdf.setFontSize(9); pdf.setFont("times", "italic"); pdf.text("(selon disponibilité)", x, y+4);

    // CREMATION & CASE JAUNE
    y += 8;
    drawSectionTitle("CREMATION", x, y, 65);
    y += 8;

    const typeCercueil = getVal('proto_cercueil');
    const typeUrne = getVal('proto_urne');

    pdf.setFont("times", "bold"); pdf.setFontSize(10); pdf.text("Cercueil", x, y);
    box("Pin", x+30, y, typeCercueil === 'Pin');
    box("Particules", x+50, y, typeCercueil === 'Particules'); 
    box("Peuplier", x+80, y, typeCercueil === 'Peuplier'); 
    box("Autre", x+110, y, typeCercueil === 'Autre');
    
    y += 4;
    pdf.setFontSize(8); pdf.setFont("times", "italic"); pdf.text("(La dimension maximum des cercueils est de 220 x 85 x 60)", x, y);

    y += 6;
    pdf.setFont("times", "bold"); pdf.setFontSize(10); pdf.text("Urne", x, y);
    box("Fournie Oui", x+30, y, typeUrne === 'Oui'); box("Non", x+60, y, typeUrne === 'Non');
    
    y += 6;
    box("Cendrier Oui", x+30, y, typeUrne === 'Cendrier');
    pdf.setFontSize(8); pdf.setFont("times", "italic"); pdf.text("(L'urne doit contenir la totalité des cendres)", x, y+4);

    const yYellow = y - 8; 
    pdf.setDrawColor(0); pdf.setLineWidth(0.8); pdf.setFillColor(255, 255, 0);
    pdf.rect(105, yYellow, 90, 18, 'FD'); 
    pdf.setFont("times", "bold"); pdf.setFontSize(9); pdf.setTextColor(0);
    pdf.text("Si le poids du défunt est supérieur à 100 kg,", 150, yYellow+5, {align:"center"});
    pdf.text("l'horaire de crémation est :", 150, yYellow+9, {align:"center"});
    pdf.setFontSize(14); 
    pdf.text("09H30", 150, yYellow+15, {align:"center"});

    // CEREMONIE
    y += 10;
    drawSectionTitle("CEREMONIE", x, y, 65);
    y += 8;

    const isSalle = document.getElementById('chk_salle_hommage').checked;
    const isMaitre = document.getElementById('chk_maitre_ceremonie').checked;
    const isRecueil = document.getElementById('chk_recueil').checked;
    const isCivile = document.getElementById('chk_civile').checked;
    const isReligieuse = document.getElementById('chk_religieuse').checked;

    pdf.setFontSize(10); pdf.setFont("times", "bold"); 
    pdf.text("Salle des hommages", x, y);
    box("Oui", x+45, y, isSalle); box("Non", x+65, y, !isSalle);
    
    y += 6;
    box("Recueillement (15 minutes)", x+45, y, isRecueil);
    y += 6;
    box("Cérémonie civile (30 minutes)", x+45, y, isCivile);
    y += 6;
    box("Cérémonie religieuse", x+45, y, isReligieuse);

    y += 8;
    pdf.setFont("times", "bold"); pdf.text("Maître de cérémonie du crématorium", x, y);
    box("Oui", x+70, y, isMaitre); box("Non", x+90, y, !isMaitre);

    y += 8;
    pdf.text("Déroulement souhaité pour la cérémonie", x, y);
    pdf.setFont("times", "italic"); pdf.setFontSize(8); pdf.text("(recueillement, musique, ...) :", x+70, y);
    pdf.line(x, y+5, 190, y+5);

    y += 8;
    pdf.setFontSize(7); pdf.setFont("times", "normal");
    pdf.text("NOUS DEMANDONS AUX OPERATEURS FUNERAIRES OU AUX FAMILLES D'ETRE PRESENTS 15 MINUTES AVANT LA CEREMONIE OU LA CREMATION", x, y);

    // JARDIN SOUVENIR
    y += 5;
    drawSectionTitle("JARDIN du SOUVENIR", x, y, 65);
    y += 8;

    const isDispersion = document.getElementById('chk_dispersion').checked;
    const columbarium = getVal('proto_columbarium');

    pdf.setFontSize(10); pdf.setFont("times", "normal");
    pdf.text("Dispersion Jardin du Souvenir", x, y); box("Oui", x+60, y, isDispersion);
    
    y += 6;
    pdf.text("Location Case Columbarium", x, y); box("Oui", x+60, y, columbarium !== "");
    pdf.text("Durée de la location", x+80, y);
    box("5 ans", x+115, y, columbarium === "5 ans"); 
    box("10 ans", x+135, y, columbarium === "10 ans"); 
    box("15 ans", x+155, y, columbarium === "15 ans");

    // FACTURATION
    y += 10;
    drawSectionTitle("FACTURATION", x, y, 65);
    y += 8;

    pdf.setFontSize(10); pdf.setFont("times", "normal");
    pdf.text("Nom, prénom ou raison sociale : ", x, y);
    pdf.setFont("times", "bold"); pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", x+60, y);
    
    y += 6;
    pdf.setFont("times", "normal"); pdf.text("Adresse : ", x, y);
    pdf.text("32 Bd Léon Jean Grégory", x+20, y);
    
    y += 6;
    pdf.text("CP : 66300", x, y);
    pdf.text("Ville : THUIR", x+40, y);
    
    y += 6;
    pdf.text("Tel : ", x, y);
    pdf.text("Portable : 07.55.18.27.77", x+40, y);
    pdf.text("Fax : ", x+100, y);

    // PIED DE PAGE
    y += 10;
    pdf.setFontSize(8); pdf.setFont("times", "bold");
    pdf.text("APRES VOTRE RESERVATION TELEPHONIQUE MERCI DE BIEN VOULOIR :", x, y);
    y += 4;
    pdf.setFont("times", "normal");
    pdf.text("- LA CONFIRMER EN RETOURNANT LE PRESENT DOCUMENT COMPLETE A LA SEM CREMATISTE CATALANE.", x, y);
    
    y += 6;
    pdf.setFont("times", "bold"); pdf.text("Mention à approuver par une signature :", x, y);
    pdf.setFont("times", "italic"); 
    pdf.text('" Je reconnais avoir pris connaissance et approuvé le Règlement Intérieur du Crématorium Public de Perpignan. "', x+60, y);

    y += 15;
    pdf.setFont("times", "bold"); pdf.setFontSize(11);
    pdf.text("Signature du demandeur :", 120, y);

    pdf.save(`Confirmation_SEM_${getVal("nom")}.pdf`);
};

window.genererAttestationPresence = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF(); 
    ajouterFiligrane(pdf); headerPF(pdf);

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text("ATTESTATION DE PRÉSENCE AUX OBSÈQUES", 105, 50, { align: "center" });
    pdf.setLineWidth(0.5); pdf.line(40, 52, 170, 52);

    let y = 80; const x = 25;
    pdf.setFontSize(12); pdf.setFont("helvetica", "normal");
    
    pdf.text("Je soussigné, Monsieur CHERKAOUI Mustapha,", x, y); y+=10;
    pdf.text("Dirigeant de l'entreprise de Pompes Funèbres Solidaire,", x, y); y+=20;
    
    pdf.text("Certifie que :", x, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text(`M. / Mme ${getVal("civilite_mandant")} ${getVal("soussigne")}`, x+20, y); y+=20;
    
    pdf.setFont("helvetica", "normal");
    pdf.text("A assisté aux funérailles de :", x, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text(`M. / Mme ${getVal("civilite_defunt")} ${getVal("nom").toUpperCase()} ${getVal("prenom")}`, x+20, y); y+=20;
    
    pdf.setFont("helvetica", "normal");
    let dateCeremonie = getVal("date_inhumation") || getVal("date_cremation");
    let lieuCeremonie = getVal("chrono_lieu_ceremonie") || getVal("cimetiere_nom") || getVal("crematorium_nom") || "Cimetière Sud";
    let heureCeremonie = getVal("chrono_heure_ceremonie") || getVal("heure_inhumation") || getVal("heure_cremation");

    pdf.text(`La cérémonie a eu lieu le ${formatDate(dateCeremonie)} à ${heureCeremonie}`, x, y); y+=10;
    pdf.text(`Au lieu suivant : ${lieuCeremonie}`, x, y); y+=30;
    
    pdf.text("Attestation délivrée pour servir et valoir ce que de droit.", x, y); y+=30;

    pdf.text(`Fait à ${getVal("faita")}, le ${formatDate(new Date().toISOString().split('T')[0])}`, 120, y); y+=10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Le Directeur,", 130, y);
    pdf.text("PF Solidaire", 130, y+5);

    pdf.save(`Attestation_Presence_${getVal("nom")}.pdf`);
};

window.genererDeroulement = function() {
    if(!window.logoBase64) window.chargerLogoBase64(); 
    const { jsPDF } = window.jspdf; const pdf = new jsPDF();
    
    pdf.setDrawColor(34, 155, 76); 
    pdf.setLineWidth(1);
    pdf.rect(5, 5, 200, 287); 

    let y = 20;
    pdf.setFont("helvetica", "bold"); pdf.setTextColor(34, 155, 76); pdf.setFontSize(14);
    pdf.text("POMPES FUNEBRES SOLIDAIRE PERPIGNAN", 105, y, { align: "center" });
    y+=6;
    pdf.setFontSize(8); pdf.setTextColor(0); pdf.setFont("helvetica", "bold");
    pdf.text("32 boulevard Léon Jean Grégory 66300 THUIR - TEL : 07.55.18.27.77", 105, y, { align: "center" });
    y+=5;
    pdf.text("HABILITATION N° : 23-66-0205  |  IMMATRICULATION : DA-081-ZQ", 105, y, { align: "center" });
    
    y+=5; 
    pdf.setDrawColor(180, 0, 0); pdf.setLineWidth(0.8);
    pdf.line(50, y, 160, y);

    y+=15;
    pdf.setFillColor(220, 252, 231);
    pdf.setDrawColor(34, 155, 76);
    pdf.rect(50, y-8, 110, 12, 'FD');
    pdf.setFontSize(12); pdf.setTextColor(0);
    pdf.text("DEROULEMENT DES OBSEQUES", 105, y, { align: "center" });

    y+=20;
    pdf.setFontSize(10); pdf.setFont("helvetica", "bold");
    pdf.text("Les Pompes Funèbres Solidaire Perpignan", 105, y, { align: "center" });
    y+=5;
    pdf.setFont("helvetica", "normal");
    pdf.text("ont la tristesse de vous faire part du décès de", 105, y, { align: "center" });

    y+=15;
    pdf.setFontSize(14); pdf.setFont("helvetica", "bold");
    const nomComplet = `${getVal("civilite_defunt")} ${getVal("prenom")} ${getVal("nom").toUpperCase()}`;
    pdf.text(nomComplet, 20, y);
    
    y+=10;
    pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
    pdf.text(`Né(e) ${getTexteNaissance()} à ${getVal("lieu_naiss")}`, 20, y);
    y+=6;
    pdf.text(`Décédé(e) le ${formatDate(getVal("date_deces"))} à ${getVal("lieu_deces")}`, 20, y);

    if (window.logoBase64) {
        try {
            pdf.saveGraphicsState();
            pdf.setGState(new pdf.GState({ opacity: 0.1 }));
            pdf.addImage(window.logoBase64, 'PNG', 55, 100, 100, 100);
            pdf.restoreGraphicsState();
        } catch (e) {}
    }

    y+=15;
    let dateCerem = getVal("date_inhumation") || getVal("date_cremation");
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let dateStr = "........................";
    if(dateCerem) {
        try { dateStr = new Date(dateCerem).toLocaleDateString('fr-FR', options); } catch(e) { dateStr = formatDate(dateCerem); }
    }
    
    pdf.setFont("helvetica", "bold");
    pdf.text(`Les obsèques auront lieu le ${dateStr}, selon le déroulement suivant :`, 20, y);

    y+=10;
    const startX = 20;
    const col1W = 30; 
    const col2W = 140; 
    const rowH = 10; 

    const drawRow = (heure, action, isHeader=false) => {
        if(isHeader) {
            pdf.setFillColor(255, 237, 213);
            pdf.rect(startX, y, col1W+col2W, 8, 'F');
            pdf.setFont("helvetica", "bold");
            pdf.text(action, startX+2, y+5);
            y += 8;
        } else {
            pdf.setDrawColor(150); pdf.setLineWidth(0.2);
            pdf.rect(startX, y, col1W, rowH);
            pdf.rect(startX+col1W, y, col2W, rowH);
            
            pdf.setFont("helvetica", "bold");
            pdf.text(heure, startX+2, y+6.5);
            
            pdf.setFont("helvetica", "normal");
            pdf.text(action, startX+col1W+2, y+6.5);
            y += rowH;
        }
    };

    drawRow("", "Chronologie de la cérémonie", true);

    const planningRows = document.querySelectorAll('#container_planning .planning-row');
    
    if(planningRows.length > 0) {
        planningRows.forEach(row => {
            const h = row.querySelector('.pl-heure').value;
            const d = row.querySelector('.pl-desc').value;
            drawRow(h, d);
        });
    } else {
        let typeOp = document.getElementById('prestation').value;
        if(typeOp === 'Crémation') {
            drawRow(getVal("heure_cremation"), `Cérémonie au Crématorium : ${getVal("crematorium_nom")}`);
        } else {
            drawRow(getVal("heure_inhumation"), `Cérémonie au Cimetière : ${getVal("cimetiere_nom")}`);
        }
    }

    const instructions = getVal('proto_instructions');
    if(instructions) {
        y += 5;
        drawRow("", "Instructions Particulières (Musique / Lectures)", true);
        const lignes = pdf.splitTextToSize(instructions, 130);
        lignes.forEach(ligne => {
            drawRow("", ligne);
        });
    }

    pdf.save(`Deroulement_Obseques_${getVal("nom")}.pdf`);
};
