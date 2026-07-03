const { SablonDocument } = require('./models');

/* ────────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM UNITAR — folosit de TOATE șabloanele de mai jos
   • Font: Arial/Helvetica (singurul garantat corect la randare PDF)
   • Culoare principală: #16244a (navy, identică cu identitatea platformei)
   • Culoare accent: #2563eb (albastru, identic cu butoanele platformei)
   • Antet instituțional identic pe fiecare document
   • Titluri, tabele, casete și subsemnări cu același stil peste tot
   ──────────────────────────────────────────────────────────────────────── */

function antet() {
  return `
    <div style="border-bottom: 3px solid #16244a; padding-bottom: 14px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 10px; letter-spacing: 1.5px; color: #64748b; text-transform: uppercase; font-weight: 700;">Direcția Generală de Asistență Socială și Protecția Copilului</div>
        <div style="font-size: 20px; font-weight: 700; color: #16244a; margin-top: 3px;">DGASPC Digital</div>
      </div>
      <div style="text-align: right; font-size: 10.5px; color: #94a3b8;">Document generat electronic</div>
    </div>`;
}

function titlu(principal, secundar) {
  return `
    <h1 style="text-align:center; font-size:19px; font-weight:700; color:#16244a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 6px 0;">${principal}</h1>
    ${secundar ? `<p style="text-align:center; font-size:12.5px; color:#475569; margin:0 0 28px 0;">${secundar}</p>` : `<div style="margin-bottom:28px;"></div>`}`;
}

function sectiune(text) {
  return `<h4 style="background:#eef2ff; color:#16244a; padding:7px 12px; margin:18px 0 10px 0; font-size:12.5px; font-weight:700; border-left:3px solid #2563eb; text-transform:uppercase; letter-spacing:0.3px;">${text}</h4>`;
}

// Subsemnare pentru cereri completate de cetățean
function semnaturaSolicitant() {
  return `
    <table style="width:100%; margin-top:50px;">
      <tr>
        <td style="width:50%; vertical-align:bottom; font-size:12.5px; color:#475569;"><strong>Data:</strong> {{DATA_CURENTA}}</td>
        <td style="width:50%; text-align:right; vertical-align:bottom;">
          <div style="font-size:12px; color:#475569; margin-bottom:4px;"><strong>Semnătură solicitant</strong></div>
          <img src="{{SEMNATURA_BASE64}}" width="150" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
        </td>
      </tr>
    </table>`;
}

// Subsemnare pentru documente medicale — DOAR semnătură, fără parafă
function semnaturaMedic(tipMedic) {
  return `
    <div style="text-align:right; margin-top:40px;">
      <p style="font-size:12.5px; color:#475569; margin:0 0 4px 0;">Data completării: <strong>{{DATA_CURENTA}}</strong></p>
      <p style="font-size:12.5px; color:#475569; margin:0 0 6px 0;"><strong>Semnătură ${tipMedic}:</strong></p>
      <img src="{{SEMNATURA_BASE64}}" width="150" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
    </div>`;
}

// Subsemnare pentru decizii/certificate — numele funcționarului care s-a ocupat de caz, nu al "președintelui comisiei"
function semnaturaFunctionar() {
  return `
    <div style="text-align:right; margin-top:60px; border-top:1px solid #e2e8f0; padding-top:20px;">
      <p style="font-size:11.5px; color:#94a3b8; margin:0 0 4px 0; text-transform:uppercase; letter-spacing:0.3px;">Funcționar responsabil de caz</p>
      <p style="font-size:14px; font-weight:700; color:#16244a; margin:0 0 8px 0;">{{NUME_FUNCTIONAR}}</p>
      <p style="font-size:11px; color:#94a3b8; margin:0 0 18px 0;">Semnătură electronică validată în platformă</p>
      <p style="font-size:12.5px; color:#475569; margin:0;">Data emiterii: <strong>{{DATA_CURENTA}}</strong></p>
    </div>`;
}

const WRAP_OPEN = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #0f172a; line-height: 1.6; padding: 40px;">`;
const WRAP_CLOSE = `</div>`;
const TABLE_OPEN = `<table style="width:100%; border-collapse:collapse; margin-bottom:20px;">`;
const TD = `padding:8px 10px; border:1px solid #cbd5e1; font-size:12.5px;`;

async function populeaza() {
  try {
    await SablonDocument.destroy({ where: {} });

    const sabloane = [

      // ── 1. CERERE — evaluare handicap ──────────────────────────────────
      {
        nume_sablon: 'Cerere_Evaluare_Handicap',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Cerere', 'pentru evaluarea în vederea încadrării în grad de handicap')}
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, posesor al actului de identitate seria <strong>{{SERIE_CI}}</strong> nr. <strong>{{NUMAR_CI}}</strong>, cu domiciliul în județul <strong>{{JUDET}}</strong>, localitatea <strong>{{ORAS}}</strong>, str. <strong>{{STRADA}}</strong>, telefon <strong>{{TELEFON}}</strong>, e-mail <strong>{{EMAIL}}</strong>.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Solicit evaluarea în cadrul Serviciului de Evaluare Complexă a Persoanelor Adulte cu Handicap, în vederea: <strong>{{TIP_CERERE}}</strong>.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Declar pe proprie răspundere că datele declarate în prezenta cerere sunt corecte și complete și că documentele depuse sunt conforme cu originalul. Sunt de acord ca datele mele cu caracter personal să fie prelucrate de DGASPC în conformitate cu reglementările GDPR.
            </p>
            ${semnaturaSolicitant()}
          ${WRAP_CLOSE}
        `
      },

      // ── 2. Scrisoare medic de familie — DOAR semnătură, fără parafă ────
      {
        nume_sablon: 'Scrisoare_Medic_Familie',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Scrisoare medicală', 'Medic de familie')}
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Nume și Prenume:</strong> {{NUME}} {{PRENUME}}</td><td style="${TD}"><strong>CNP:</strong> {{CNP}}</td></tr>
              <tr><td style="${TD}"><strong>Domiciliu:</strong> {{DOMICILIU}}</td><td style="${TD}"><strong>Telefon:</strong> {{TELEFON}}</td></tr>
            </table>
            ${sectiune('1. Anamneza')}<p>{{ANAMNEZA}}</p>
            ${sectiune('2. Diagnostic principal')}<p>{{DIAGNOSTIC_PRINCIPAL}}</p>
            ${sectiune('3. Diagnostice secundare')}<p>{{DIAGNOSTIC_SECUNDAR}}</p>
            ${sectiune('4. Internări în spital')}<ul>{{INTERNARI_HTML}}</ul>
            ${sectiune('5. Starea de deplasabilitate')}<p>{{DEPLASABIL}}</p>
            ${semnaturaMedic('medic de familie')}
          ${WRAP_CLOSE}
        `
      },

      // ── 3. Referat medic specialist — DOAR semnătură, fără parafă ──────
      {
        nume_sablon: 'Referat_Medic_Specialist',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Referat medical', 'Medic specialist')}
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Nume și Prenume:</strong> {{NUME}} {{PRENUME}}</td><td style="${TD}"><strong>CNP:</strong> {{CNP}}</td></tr>
              <tr><td style="${TD}"><strong>Domiciliu:</strong> {{DOMICILIU}}</td><td style="${TD}"><strong>Telefon:</strong> {{TELEFON}}</td></tr>
            </table>
            ${sectiune('1. Diagnostic de specialitate')}<p>{{DIAGNOSTIC}}</p>
            ${sectiune('2. Evoluția bolii')}<p>{{EVOLUTIE_BOALA}}</p>
            ${sectiune('3. Pronostic')}
            <ul><li><strong>De viață:</strong> {{PRONOSTIC_VIATA}}</li><li><strong>De vindecare:</strong> {{PRONOSTIC_VINDECARE}}</li></ul>
            ${sectiune('4. Tratamente urmate')}<p>{{TRATAMENTE_URMATE}}</p>
            ${sectiune('5. Evaluare terapeutică')}
            <ul><li><strong>Răspuns la tratament:</strong> {{RASPUNS_TRATAMENT}}</li><li><strong>Cooperare medic-pacient:</strong> {{COOPERARE}}</li></ul>
            ${semnaturaMedic('medic specialist')}
          ${WRAP_CLOSE}
        `
      },

      // ── 4. Anchetă socială (handicap) ───────────────────────────────────
      {
        nume_sablon: 'Ancheta_Sociala',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Anchetă socială')}
            <p>Subsemnatul/a, funcționar în cadrul compartimentului Asistență Socială, am efectuat ancheta socială pentru:</p>
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Nume:</strong> {{NUME}} {{PRENUME}}</td><td style="${TD}"><strong>CNP:</strong> {{CNP}}</td></tr>
              <tr><td style="${TD}"><strong>Domiciliu:</strong> {{DOMICILIU}}</td><td style="${TD}"><strong>Telefon:</strong> {{TELEFON}}</td></tr>
            </table>
            ${sectiune('I. Date generale')}
            <ul style="margin-top:0;">
              <li><strong>Ocupația:</strong> {{OCUPATIA}} | <strong>Studii:</strong> {{STUDII}}</li>
              <li><strong>Stare civilă:</strong> {{STARE_CIVILA}} | <strong>Are copii:</strong> {{COPII}} (Detalii: {{DETALII_COPII}})</li>
              <li><strong>Reprezentant legal:</strong> {{REPREZENTANT_LEGAL}} (Detalii: {{DETALII_REPREZENTANT}})</li>
            </ul>
            ${sectiune('II. Autonomie și activități')}
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Igienă corporală: <b>{{IGIENA_CORPORALA}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Îmbrăcat/Dezbrăcat: <b>{{IMBRACAT_DEZBRACAT}}</b></td></tr>
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Servire și hrănire: <b>{{SERVIRE_HRANIRE}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Mobilizare: <b>{{MOBILIZARE}}</b></td></tr>
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Deplasare interior: <b>{{DEPLASARE_INTERIOR}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Deplasare exterior: <b>{{DEPLASARE_EXTERIOR}}</b></td></tr>
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Dispozitive: <b>{{DISPOZITIVE_DEPLASARE}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Mijloace comunicare: <b>{{COMUNICARE_MIJLOACE}}</b></td></tr>
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Preparare hrană: <b>{{PREPARARE_HRANA}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Activități gospodărești: <b>{{ACTIVITATI_GOSPODARESTI}}</b></td></tr>
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Gestionare venituri: <b>{{GESTIONARE_VENITURI}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Cumpărături: <b>{{CUMPARATURI}}</b></td></tr>
              <tr><td style="border: 1px solid #cbd5e1; padding: 5px;">Admin. tratament: <b>{{ADMINISTRARE_TRATAMENT}}</b></td><td style="border: 1px solid #cbd5e1; padding: 5px;">Transport/Timp liber: <b>{{UTILIZARE_TRANSPORT}} / {{TIMP_LIBER}}</b></td></tr>
            </table>
            ${sectiune('III. Evaluare senzorială și cognitivă')}
            <p style="margin:0;">Memorie: <b>{{MEMORIE}}</b> | Acuitate vizuală: <b>{{VAZ}}</b> | Comunicare: <b>{{COMUNICARE}}</b> | Orientare: <b>{{ORIENTARE}}</b> | Comportament: <b>{{COMPORTAMENT}}</b></p>
            ${sectiune('IV. Locuință și mediu familial')}
            <p style="margin:0;">Locuință: <b>{{TIP_LOCUINTA}}</b> ({{NR_CAMERE}} camere) | Încălzire: <b>{{INCALZIRE}}</b> | Apă: <b>{{APA_CURENTA}}</b> | Dotări: <b>{{DOTARI_LOCUINTA}}</b></p>
            <p style="margin:0;">Trăiește: <b>{{COABITARE}}</b> | Coabitant bolnav: <b>{{COABITANT_BOLNAV}}</b> | Adicții: <b>{{COABITANT_ADICTII}}</b></p>
            <p style="margin:0;">Relații cu familia: <b>{{RELATIE_FAMILIE}}</b> | Risc abuz/neglijare: <b>{{RISC_ABUZ}} / {{RISC_NEGLIJARE}}</b></p>
            <p style="margin:0;">Persoană contact urgență: <b>{{PERS_CONTACT}}</b></p>
            <p style="margin:0;">Prieteni: <b>{{ARE_PRIETENI}}</b> ({{RELATII_PRIETENIE}}) | Participare în comunitate: <b>{{PARTICIPARE_COMUNITATE}}</b></p>
            ${sectiune('V. Concluzii')}
            <p style="margin:0;">{{CONCLUZII}}</p>
            <div style="text-align: right; margin-top: 20px;">
              <p style="font-size:12.5px; color:#475569;">Data completării: <strong>{{DATA_CURENTA}}</strong></p>
              <img src="{{SEMNATURA_BASE64}}" width="130" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
            </div>
          ${WRAP_CLOSE}
        `
      },

      // ── 5. CERTIFICAT — numele funcționarului, NU „Președinte Comisie” ──
      {
        nume_sablon: 'Certificat_Incadrare_Handicap',
        tip_dosar: 'certificat_handicap',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Certificat', 'de încadrare în grad de handicap')}
            <p style="text-align: justify; margin-bottom: 20px;">
              Comisia de evaluare persoane adulte cu handicap, constituită în temeiul Legii nr.448/2006, privind protecția și promovarea drepturilor persoanelor cu handicap, republicată, cu modificările și completările ulterioare, evaluând dosarul și propunerea serviciului de evaluare complexă a persoanelor adulte cu handicap:
            </p>
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Privind pe:</strong> {{NUME}} {{PRENUME}}</td><td style="${TD}"><strong>C.N.P.:</strong> {{CNP}}</td></tr>
              <tr><td style="${TD}" colspan="2"><strong>Domiciliul:</strong> Județ {{JUDET}}, Oraș {{ORAS}}</td></tr>
            </table>
            ${sectiune('Stabilește următoarele')}
            <p><strong>1. Se încadrează în gradul de handicap:</strong> {{GRAD}}</p>
            <p><strong>2. Valabilitate:</strong> {{VALABILITATE}}</p>
            <p><strong>3. Termen de revizuire:</strong> {{REVIZUIRE}}</p>
            ${semnaturaFunctionar()}
          ${WRAP_CLOSE}
        `
      },

      // ── 6. CERERE — alocație de stat ────────────────────────────────────
      {
        nume_sablon: 'Cerere_Alocatie_Stat',
        tip_dosar: 'alocatie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Cerere', 'pentru acordarea Alocației de Stat pentru Copii')}
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, posesor al actului de identitate seria <strong>{{SERIE_CI}}</strong> nr. <strong>{{NUMAR_CI}}</strong>, cu domiciliul în județul <strong>{{JUDET}}</strong>, localitatea <strong>{{ORAS}}</strong>, str. <strong>{{STRADA}}</strong>, telefon <strong>{{TELEFON}}</strong>, e-mail <strong>{{EMAIL}}</strong>, în calitate de reprezentant legal, solicit prin prezenta acordarea alocației de stat pentru copilul:
            </p>
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 16px; margin: 18px 0;">
              <p style="margin: 4px 0;"><strong>Nume și Prenume Copil:</strong> {{NUME_COPIL}} {{PRENUME_COPIL}}</p>
              <p style="margin: 4px 0;"><strong>CNP Copil:</strong> {{CNP_COPIL}}</p>
            </div>
            <p style="text-align: justify; text-indent: 40px;">
              Date referitoare la celălalt părinte (dacă este cazul): <strong>{{NUME_SOT}}</strong> (CNP: <strong>{{CNP_SOT}}</strong>).
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Declar pe proprie răspundere că datele declarate în prezenta cerere sunt corecte și complete. Sunt de acord ca datele mele cu caracter personal să fie prelucrate de DGASPC în conformitate cu reglementările GDPR.
            </p>
            ${semnaturaSolicitant()}
          ${WRAP_CLOSE}
        `
      },

      // ── 7. CERERE — indemnizație creștere copil ─────────────────────────
      {
        nume_sablon: 'Cerere_Indemnizatie',
        tip_dosar: 'indemnizatie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Cerere', 'pentru acordarea Indemnizației de Creștere a Copilului (0-2 ani)')}
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, domiciliat/ă în <strong>{{JUDET}}, {{ORAS}}, {{STRADA}}</strong>, solicit acordarea indemnizației lunare pentru creșterea copilului:
            </p>
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 16px; margin: 18px 0;">
              <p style="margin: 4px 0;"><strong>Nume și Prenume Copil:</strong> {{NUME_COPIL}} {{PRENUME_COPIL}}</p>
              <p style="margin: 4px 0;"><strong>CNP Copil:</strong> {{CNP_COPIL}}</p>
            </div>
            <p style="text-align: justify; text-indent: 40px;">
              Beneficiarul vizat pentru acordarea acestei indemnizații este: <strong>{{BENEFICIAR}}</strong> (Nume partener: {{NUME_SOT}}, CNP Partener: {{CNP_SOT}}).
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Confirm îndeplinirea condițiilor legale (inclusiv stagiul de cotizare) și anexez documentele justificative.
            </p>
            ${semnaturaSolicitant()}
          ${WRAP_CLOSE}
        `
      },

      // ── 8. Adeverință școlară (reprezentant unitate de învățământ) ─────
      {
        nume_sablon: 'Adeverinta_Scolara',
        tip_dosar: 'alocatie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Adeverință școlară', 'Unitatea de învățământ: {{INSTITUTIE}}')}
            <p style="text-align: justify;">
              Se adeverește prin prezenta că elevul/copilul <strong>{{NUME_COPIL}} {{PRENUME_COPIL}}</strong> (CNP: {{CNP_COPIL}}), aflat în grija reprezentantului legal domnul/doamna <strong>{{NUME_PARINTE}} {{PRENUME_PARINTE}}</strong> (CNP: {{CNP_PARINTE}}), este înscris la unitatea noastră de învățământ, având următoarea situație școlară:
            </p>
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Clasa / Grupa:</strong></td><td style="${TD}">{{CLASA}}</td></tr>
              <tr><td style="${TD}"><strong>Media generală / Calificative:</strong></td><td style="${TD}">{{MEDIA}}</td></tr>
              <tr><td style="${TD}"><strong>Număr absențe nemotivate:</strong></td><td style="${TD}">{{NR_ABSENTE}}</td></tr>
            </table>
            <p style="font-size: 11px; color: #94a3b8;">Prezenta adeverință a fost eliberată pentru a-i servi la dosarul de alocație DGASPC.</p>
            <div style="text-align: right; margin-top: 40px;">
              <p style="font-size:12.5px; color:#475569;">Data emiterii: <strong>{{DATA_CURENTA}}</strong></p>
              <p style="font-size:12.5px; color:#475569;">Reprezentant unitate ({{TIP_REPREZENTANT}}):</p>
              <img src="{{SEMNATURA_BASE64}}" width="150" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
            </div>
          ${WRAP_CLOSE}
        `
      },

      // ── 9. DECIZIE — numele funcționarului, NU rol generic ──────────────
      {
        nume_sablon: 'Decizie_Beneficiu_Copil',
        tip_dosar: 'alocatie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Decizie de soluționare', 'Dosar nr. {{NUMAR_DOSAR}}')}
            <p style="text-align: justify; margin-bottom: 20px;">
              În urma analizării documentației depuse și a îndeplinirii criteriilor prevăzute de lege, Departamentul pentru Protecția Copilului a dispus următoarea rezoluție:
            </p>
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Privind pe solicitantul:</strong> {{NUME}} {{PRENUME}}</td><td style="${TD}"><strong>C.N.P.:</strong> {{CNP}}</td></tr>
              <tr><td style="${TD}" colspan="2"><strong>Tip cerere:</strong> {{TIP_DOSAR_FORMATAT}}</td></tr>
            </table>
            <div style="margin-top: 20px; padding: 18px; border: 2px solid {{CULOARE_DECIZIE}}; background-color: {{BG_DECIZIE}}; border-radius: 6px;">
              <h4 style="margin: 0; color: {{CULOARE_DECIZIE}}; text-align: center; font-size: 17px;">REZOLUȚIE: {{STATUS_DECIZIE}}</h4>
              <p style="text-align: center; margin-top: 10px;">{{MOTIV_DECIZIE}}</p>
            </div>
            ${semnaturaFunctionar()}
          ${WRAP_CLOSE}
        `
      },

      // ── 10. CERERE — adopție ─────────────────────────────────────────────
      {
        nume_sablon: 'Cerere_Adoptie',
        tip_dosar: 'adoptie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Cerere', 'pentru evaluarea în vederea obținerii atestatului de familie adoptatoare')}
            <p><strong>DOMNULE DIRECTOR,</strong></p>
            <p style="text-align: justify; text-indent: 40px;">
              Subsemnatul/a <strong>{{NUME}} {{PRENUME}}</strong>, CNP <strong>{{CNP}}</strong>, cu domiciliul în județul <strong>{{JUDET}}</strong>, localitatea <strong>{{ORAS}}</strong>, str. <strong>{{STRADA}}</strong>, telefon <strong>{{TELEFON}}</strong>.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Date referitoare la soț/soție (dacă este cazul): <strong>{{NUME_SOT}}</strong>, CNP: <strong>{{CNP_SOT}}</strong>.
            </p>
            <p style="text-align: justify; text-indent: 40px;">
              Prin prezenta, solicităm declanșarea procedurii de evaluare în vederea obținerii atestatului de familie adoptatoare.
              Suntem deschiși la adopția unui copil de gen: <strong>{{GEN_COPIL}}</strong>.
              Disponibilitate pentru adopția unui copil greu adoptabil (vârstă &gt;4 ani, afecțiuni, grupe de frați): <strong>{{GREU_ADOPTABIL}}</strong>.
            </p>
            <table style="width: 100%; margin-top: 50px;">
              <tr>
                <td style="width: 50%; vertical-align: bottom;">
                  <div style="font-size:12px; color:#475569; margin-bottom:4px;"><strong>Semnătură titular</strong></div>
                  <img src="{{SEMNATURA_BASE64}}" width="140" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
                </td>
                <td style="width: 50%; text-align: right; vertical-align: bottom;">
                  <div style="font-size:12px; color:#475569; margin-bottom:4px;"><strong>Semnătură soț/soție</strong></div>
                  <img src="{{SEMNATURA_SOT_BASE64}}" width="140" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
                </td>
              </tr>
              <tr><td colspan="2" style="padding-top: 20px; font-size:12.5px; color:#475569;">Data: <strong>{{DATA_CURENTA}}</strong></td></tr>
            </table>
          ${WRAP_CLOSE}
        `
      },

      // ── 11. Certificat medical adopție — DOAR semnătură, fără parafă ───
      {
        nume_sablon: 'Adeverinta_Medicala_Adoptie',
        tip_dosar: 'adoptie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Certificat medical privind starea de sănătate', '(Eliberat în vederea adopției)')}
            ${TABLE_OPEN}
              <tr><td style="${TD}"><strong>Pacient:</strong> {{NUME_PACIENT}}</td><td style="${TD}"><strong>CNP:</strong> {{CNP_PACIENT}}</td></tr>
            </table>
            ${sectiune('1. Boli cronice / Afecțiuni psihiatrice')}<p>{{BOLI_CRONICE}}</p>
            ${sectiune('2. Istoric medical relevant')}<p>{{ISTORIC}}</p>
            ${sectiune('3. Concluzie')}<p>În urma consultației clinice, pacientul <strong>{{APT_ADOPTIE}}</strong> apt din punct de vedere medical pentru a adopta un copil.</p>
            ${semnaturaMedic('medic de familie')}
          ${WRAP_CLOSE}
        `
      },

      // ── 12. Cazier judiciar (adopție) ───────────────────────────────────
      {
        nume_sablon: 'Cazier_Judiciar_Adoptie',
        tip_dosar: 'adoptie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Certificat de cazier judiciar', 'Ministerul Afacerilor Interne — Inspectoratul de Poliție Județean')}
            <p style="text-align: justify;">Se atestă prin prezenta situația juridică pentru solicitantul principal (și soț/soție, dacă este cazul), aparținând Dosarului DGASPC nr. <strong>{{NUMAR_DOSAR}}</strong>.</p>
            ${TABLE_OPEN}
              <tr><td style="${TD}" width="35%"><strong>Antecedente penale:</strong></td><td style="${TD}">{{ANTECEDENTE}}</td></tr>
              <tr><td style="${TD}"><strong>Mențiuni/Detalii:</strong></td><td style="${TD}">{{MENTIUNI_CAZIER}}</td></tr>
            </table>
            <p style="font-size: 11px; color: #94a3b8; text-align: justify;">Documentul a fost generat și validat digital prin intermediul platformei securizate DGASPC, servind exclusiv procedurii de evaluare pentru adopție națională.</p>
            <div style="text-align: right; margin-top: 40px;">
              <p style="font-size:12.5px; color:#475569;">Generat la data: <strong>{{DATA_CURENTA}}</strong></p>
              <p style="font-size:12.5px; color:#475569;">Validat de reprezentantul legal al Poliției:</p>
              <img src="{{SEMNATURA_BASE64}}" width="130" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
            </div>
          ${WRAP_CLOSE}
        `
      },

      // ── 13. Adeverință de domiciliu ─────────────────────────────────────
      {
        nume_sablon: 'Adeverinta_Domiciliu',
        tip_dosar: 'adoptie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Adeverință de domiciliu', 'Direcția de Evidență a Persoanelor / Primăria Locală')}
            <p style="text-align: justify;">
              Se adeverește prin prezenta, în urma verificărilor în bazele de date și a declarațiilor solicitanților, că domnul/doamna <strong>{{NUME}} {{PRENUME}}</strong>
              (CNP: {{CNP}}) are domiciliul stabil / reședința în fapt la adresa:
            </p>
            <div style="padding: 14px 16px; margin: 18px 0; border-left: 4px solid #2563eb; background: #eff6ff; border-radius: 4px; font-weight: bold; font-size: 14px;">
              {{ADRESA_COMPLETA}}
            </div>
            <p><strong>Confirmare potrivire adresă cu realitatea:</strong> {{CONFIRMARE_ADRESA}}</p>
            <p><strong>Alte detalii / mențiuni:</strong> {{DETALII_ADRESA}}</p>
            <div style="text-align: right; margin-top: 50px;">
              <p style="font-size:12.5px; color:#475569;">Data eliberării: <strong>{{DATA_CURENTA}}</strong></p>
              <img src="{{SEMNATURA_BASE64}}" width="140" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
            </div>
          ${WRAP_CLOSE}
        `
      },

      // ── 14. Anchetă socială (adopție) ───────────────────────────────────
      {
        nume_sablon: 'Ancheta_Sociala_Adoptie',
        tip_dosar: 'adoptie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Anchetă socială pentru adopție')}
            <p>Efectuată pentru familia/persoana: <strong>{{NUME}} {{PRENUME}}</strong></p>
            ${sectiune('1. Condiții locative')}<p>{{CONDITII_LOCATIVE}}</p>
            ${sectiune('2. Situația veniturilor')}<p>{{VENITURI}}</p>
            ${sectiune('3. Istoric familial și relații sociale')}<p>{{ISTORIC_FAMILIAL}}</p>
            ${sectiune('4. Motivația adopției')}<p>{{MOTIVATIE}}</p>
            ${sectiune('5. Concluzia asistentului social')}<p>Garanții morale și materiale: <strong>{{CONCLUZIE_ANCHETA}}</strong></p>
            <div style="text-align: right; margin-top: 30px;">
              <p style="font-size:12.5px; color:#475569;">Data completării: <strong>{{DATA_CURENTA}}</strong></p>
              <img src="{{SEMNATURA_BASE64}}" width="120" style="border-bottom:1px solid #16244a; padding-bottom:4px;" />
            </div>
          ${WRAP_CLOSE}
        `
      },

      // ── 15. DECIZIE — numele funcționarului, NU „Director General” ──────
      // ── 15. CERTIFICAT DE ADOPȚIE — cu numele, prenumele și CNP-ul copilului ──
      {
        nume_sablon: 'Decizie_Adoptie',
        tip_dosar: 'adoptie',
        continut_html: `
          ${WRAP_OPEN}
            ${antet()}
            ${titlu('Certificat de adopție')}
            <p style="text-align: justify; margin-bottom: 20px;">
              Direcția Generală de Asistență Socială și Protecția Copilului, în temeiul deciziei comisiei de adopții și a documentației anexate Dosarului nr. <strong>{{NUMAR_DOSAR}}</strong>, atestă prin prezenta finalizarea procedurii de adopție, după cum urmează:
            </p>
            ${TABLE_OPEN}
              <tr><td style="${TD}" colspan="2"><strong>Părinte(le) adoptator:</strong> {{NUME}} {{PRENUME}} (CNP: {{CNP}})</td></tr>
            </table>
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 16px; margin: 18px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>Copil adoptat:</strong> {{NUME_COPIL_ADOPTAT}} {{PRENUME_COPIL_ADOPTAT}}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>CNP copil:</strong> {{CNP_COPIL_ADOPTAT}}</p>
            </div>
            <p style="text-align: justify;">
              Prezentul certificat atestă că adopția de mai sus a fost aprobată și înregistrată în evidențele DGASPC, copilul dobândind, potrivit legii, calitatea de fiu/fiică al/a adoptatorului menționat mai sus.
            </p>
            ${semnaturaFunctionar()}
          ${WRAP_CLOSE}
        `
      }
    ];

    await SablonDocument.bulkCreate(sabloane);
    console.log("✅ Toate șabloanele (uniformizate) au fost introduse cu succes!");
    process.exit();
  } catch (err) {
    console.error("❌ Eroare la populare:", err);
    process.exit(1);
  }
}
populeaza();