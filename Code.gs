/* ============================================================
   TORRE DE CONTROLE GRF — Integração GPS Eclipse
   ============================================================ */

var CONTAS = [
  { nome: "Super Vinhos (deivid)",   account: "supervinhos", user: "deivid",    prop: "ECLIPSE_PASSWORD" },
  { nome: "Cotrim",                   account: "cotrim",      user: "cotrim",    prop: "ECLIPSE_PWD_COTRIM" },
  { nome: "Super Vinhos (francisco)", account: "supervinhos", user: "francisco", prop: "ECLIPSE_PWD_FRANCISCO" }
];

var BASE_URL = "http://gpseclipse.com/trackv2/Track";
var SHEET_ID = "1bsEPT-xN4nWpAeLdgPFlt0Sv92lA8uymlw-LcuGCLTM";
var ABA = "Programação";

/* ============================================================
   PONTOS DE TRANSBORDO (detecção por coordenada)
   A chegada é marcada quando o veículo entra no raio do ponto.
   Não depende do nome da cerca no Eclipse.
   ============================================================ */
var TRANSBORDOS = [
  { nome: "Penha RJ",        destino: ["rio de janeiro", "penha"],        lat: -22.82105, lon: -43.27655, raio: 600 },
  { nome: "Barra Mansa",     destino: ["barra mansa"],                    lat: -22.55510, lon: -44.13016, raio: 400 },
  { nome: "Lagos",           destino: ["lagos", "sao pedro", "cabo frio", "aldeia"],   lat: -22.83871, lon: -42.14206, raio: 400 },
  { nome: "Campos",          destino: ["campos", "goytacaz"],             lat: -21.71256, lon: -41.30403, raio: 400 },
  { nome: "Duque de Caxias", destino: ["duque de caxias", "caxias"],      lat: -22.68069, lon: -43.29568, raio: 400 },
  { nome: "Angra",           destino: ["angra"],                          lat: -22.99707, lon: -44.23958, raio: 400 }
];

/* Cerca operacional da base GRF.
   O ponto informado está dentro da cerca exibida no Eclipse.
   A histerese evita falso sai/entra causado por oscilação do GPS. */
var BASE_GRF = {
  nome: "GRF Distribuição - Três Rios",
  lat: -22.07996,
  lon: -43.21254,
  raioEntrada: 350,
  raioSaida: 450,
  pontosForaParaConfirmar: 2
};

/* ============================================================
   HORÁRIO-LIMITE — sempre a saída da GRF
   ============================================================ */
var HORARIO_LIMITE = [
  { match: ["sao pedro da aldeia", "cabo frio", "lagos"],   limite: "00:00" },
  { match: ["campos", "goytacaz"],                         limite: "00:00" },
  { match: ["angra", "angra dos reis"],                    limite: "00:00" },
  { match: ["barra mansa"],                    limite: "04:00" },
  { match: ["petropolis", "sapucaia"],         limite: "06:00" },
  { match: ["tres rios", "paraiba do sul"],    limite: "07:00" },
  { match: ["rio de janeiro", "penha"],        limite: "03:00" }
];
var HORARIO_LIMITE_PADRAO = "05:00";

/* ============================================================
   COLUNAS — localizadas pelo NOME do cabeçalho
   ============================================================ */
var COLS = {
  data:          ["data"],
  placa:         ["placa"],
  destino:       ["cidade/rota", "cidade", "destino", "rota"],
  transportadora:["transportadora"],
  saiu:          ["saiu?", "saiu"],
  horaSaida:     ["hora saída", "hora saida"],
  horarioLimite: ["horário-limite", "horario-limite", "horário limite", "horario limite"],
  atraso:        ["atraso"],
  chegou:        ["chegou?", "chegou"],
  horaChegada:   ["hora chegada"],
  statusGPS:     ["status gps", "status"],
  ultimaPosicao: ["última posição", "ultima posicao", "posição", "posicao"],
  idViagem:      ["id viagem", "id da viagem"],
  dataHoraSaida: ["data/hora saída", "data/hora saida"],
  dataHoraChegada:["data/hora chegada"]
};

var COLUNAS_PADRAO = [
  "Data", "Placa", "Cidade/Rota", "Transportadora",
  "Saiu?", "Hora Saída", "Horário-Limite", "Atraso",
  "Chegou?", "Hora Chegada", "Status GPS", "Última Posição"
];

/* Colunas internas. São criadas no fim da Programação e ficam ocultas. */
var COLUNAS_TECNICAS = ["ID Viagem", "Data/Hora Saída", "Data/Hora Chegada"];

var CABECALHO_HISTORICO = [
  "ID Viagem", "Data Operacional", "Placa", "Motorista",
  "Transportadora", "Destino", "Tipo", "Horário-Limite",
  "Saiu?", "Hora Saída", "Data/Hora Saída", "Atraso (min)",
  "Chegou?", "Hora Chegada", "Data/Hora Chegada", "Atualizado em"
];

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function semAcento(txt) {
  return String(txt || "").toLowerCase()
    .replace(/[áàâã]/g,"a").replace(/[éê]/g,"e").replace(/í/g,"i")
    .replace(/[óôõ]/g,"o").replace(/ú/g,"u").replace(/ç/g,"c").trim();
}

function mapearColunas(sheet) {
  var ultimaCol = Math.max(sheet.getLastColumn(), 1);
  var cab = sheet.getRange(1, 1, 1, ultimaCol).getDisplayValues()[0];
  var mapa = {};
  Object.keys(COLS).forEach(function(chave){
    var alt = COLS[chave].map(semAcento);
    mapa[chave] = null;
    for (var i = 0; i < cab.length; i++) {
      if (alt.indexOf(semAcento(cab[i])) !== -1) { mapa[chave] = i + 1; return; }
    }
  });
  return mapa;
}

function getTransbordo(destino) {
  var alvo = semAcento(destino);
  for (var i = 0; i < TRANSBORDOS.length; i++) {
    for (var j = 0; j < TRANSBORDOS[i].destino.length; j++) {
      if (alvo.indexOf(semAcento(TRANSBORDOS[i].destino[j])) !== -1) return TRANSBORDOS[i];
    }
  }
  return null;
}

function getHorarioLimite(destino) {
  var alvo = semAcento(destino);
  for (var i = 0; i < HORARIO_LIMITE.length; i++) {
    for (var j = 0; j < HORARIO_LIMITE[i].match.length; j++) {
      if (alvo.indexOf(HORARIO_LIMITE[i].match[j]) !== -1) return HORARIO_LIMITE[i].limite;
    }
  }
  return HORARIO_LIMITE_PADRAO;
}

/* Distância em metros (Haversine) */
function distanciaMetros(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var toRad = function(g){ return g * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat/2)*Math.sin(dLat/2)
        + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function ehSim(valor) {
  var v = semAcento(valor);
  return v === "sim" || v === "s" || v === "x" || v === "ok"
      || v === "true" || v === "1";
}

function parseHora(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return { h: valor.getHours(), m: valor.getMinutes() };
  }
  var texto = String(valor).trim().replace(/^'/, "");
  var m = texto.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  var h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h: h, m: min };
}

function copiarData(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate(),
                  data.getHours(), data.getMinutes(), data.getSeconds(), data.getMilliseconds());
}

function combinarDataHora(dataBase, hora) {
  var p = parseHora(hora);
  if (!dataBase || !p) return null;
  return new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), p.h, p.m, 0, 0);
}

function dataHoraPrevista(dataOperacional, horarioLimite) {
  return combinarDataHora(dataOperacional, horarioLimite);
}

/* Migração de horários antigos que não guardavam a data.
   Saídas a partir das 18h para limites da manhã pertencem à noite anterior. */
function inferirDataHoraSaida(dataOperacional, horaSaida, horarioLimite) {
  var saida = combinarDataHora(dataOperacional, horaSaida);
  var pSaida = parseHora(horaSaida), pLimite = parseHora(horarioLimite);
  if (!saida || !pSaida || !pLimite) return null;
  var minSaida = pSaida.h * 60 + pSaida.m;
  var minLimite = pLimite.h * 60 + pLimite.m;
  if (minSaida >= 18 * 60 && minLimite <= 12 * 60) saida.setDate(saida.getDate() - 1);
  return saida;
}

function inferirDataHoraChegada(dataOperacional, horaChegada, dataHoraSaida) {
  var chegada = combinarDataHora(dataOperacional, horaChegada);
  if (!chegada) return null;
  if (dataHoraSaida && chegada < dataHoraSaida) chegada.setDate(chegada.getDate() + 1);
  return chegada;
}

function calcularAtrasoMin(dataHoraLimite, dataHoraReferencia) {
  if (!dataHoraLimite || !dataHoraReferencia) return 0;
  return Math.round((dataHoraReferencia.getTime() - dataHoraLimite.getTime()) / 60000);
}

function dataValida(valor) {
  return Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime());
}

function isoOuNull(valor) {
  return dataValida(valor) ? valor.toISOString() : null;
}

function chaveData(valor) {
  if (!dataValida(valor)) return "";
  return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function formatarAtraso(min) {
  if (min <= 0) return "No prazo";
  var h = Math.floor(min/60), m = min % 60;
  if (h === 0) return "+" + m + "min";
  if (m === 0) return "+" + h + "h";
  return "+" + h + "h" + (m < 10 ? "0"+m : m);
}

function normalizarPlaca(texto) {
  if (!texto) return "";
  var t = String(texto).toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
  var m = t.match(/([A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/);
  return m ? m[1] : t;
}

/* Roteirização + 1 dia = data real de saída.
   Lê o TEXTO da data pra não sofrer deslocamento de fuso. */
function dataOperacionalDeTexto(textoData) {
  if (!textoData) return null;
  var p = String(textoData).trim().split("/");
  if (p.length !== 3) return null;
  var dia = parseInt(p[0],10), mes = parseInt(p[1],10)-1, ano = parseInt(p[2],10);
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
  return new Date(ano, mes, dia + 1, 12, 0, 0);
}

/* ============================================================
   SETUP — roda 1x, cria o que faltar
   ============================================================ */
function configurarPlanilha() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var prog = ss.getSheetByName(ABA);
  var ultimaCol = Math.max(prog.getLastColumn(), 1);
  var cab = prog.getRange(1, 1, 1, ultimaCol).getDisplayValues()[0];
  var existentes = cab.map(semAcento);
  var proxima = ultimaCol + 1;
  while (proxima > 1 && !cab[proxima - 2]) proxima--;

  COLUNAS_PADRAO.forEach(function(nome){
    if (existentes.indexOf(semAcento(nome)) === -1) {
      prog.getRange(1, proxima).setValue(nome);
      Logger.log("Criada coluna: " + nome);
      proxima++;
    }
  });
  prog.setFrozenRows(1);
  garantirColunasTecnicas(prog);
  prepararHistorico(ss);
  Logger.log("Mapa de colunas: " + JSON.stringify(mapearColunas(prog)));
}

function garantirColunasTecnicas(sheet) {
  var ultimaCol = Math.max(sheet.getLastColumn(), 1);
  var cab = sheet.getRange(1, 1, 1, ultimaCol).getDisplayValues()[0];
  var existentes = cab.map(semAcento);
  var proxima = ultimaCol + 1;

  COLUNAS_TECNICAS.forEach(function(nome){
    if (existentes.indexOf(semAcento(nome)) === -1) {
      sheet.getRange(1, proxima).setValue(nome);
      existentes.push(semAcento(nome));
      proxima++;
    }
  });

  var mapa = mapearColunas(sheet);
  [mapa.idViagem, mapa.dataHoraSaida, mapa.dataHoraChegada].forEach(function(c){
    if (c) sheet.hideColumns(c);
  });
  if (mapa.dataHoraSaida) sheet.getRange(2, mapa.dataHoraSaida, Math.max(sheet.getMaxRows()-1,1), 1).setNumberFormat("dd/MM/yyyy HH:mm");
  if (mapa.dataHoraChegada) sheet.getRange(2, mapa.dataHoraChegada, Math.max(sheet.getMaxRows()-1,1), 1).setNumberFormat("dd/MM/yyyy HH:mm");
  return mapa;
}

function historicoEstaAtualizado(hist) {
  if (hist.getLastColumn() < CABECALHO_HISTORICO.length) return false;
  var cab = hist.getRange(1,1,1,CABECALHO_HISTORICO.length).getDisplayValues()[0];
  for (var i = 0; i < CABECALHO_HISTORICO.length; i++) {
    if (semAcento(cab[i]) !== semAcento(CABECALHO_HISTORICO[i])) return false;
  }
  return true;
}

/* Faz backup e converte, uma única vez, o Histórico antigo/misto. */
function prepararHistorico(ss) {
  var hist = ss.getSheetByName("Histórico");
  if (!hist) hist = ss.insertSheet("Histórico");
  if (historicoEstaAtualizado(hist)) return hist;

  if (hist.getLastRow() > 1 || hist.getLastColumn() > 1) {
    var nomeBackup = "Histórico_backup_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    hist.copyTo(ss).setName(nomeBackup);
  }

  var lastRow = hist.getLastRow();
  var lastCol = Math.max(Math.min(hist.getLastColumn(), 12), 1);
  var valores = lastRow > 1 ? hist.getRange(2,1,lastRow-1,lastCol).getValues() : [];
  var textos = lastRow > 1 ? hist.getRange(2,1,lastRow-1,lastCol).getDisplayValues() : [];
  var migradas = [];

  for (var i = 0; i < valores.length; i++) {
    var r = valores[i], t = textos[i];
    if (!r[0] && !t[1]) continue;
    var tipoNaColunaE = semAcento(t[4]);
    var layoutNovo = tipoNaColunaE === "entrega" || tipoNaColunaE === "transbordo";

    var dataOper = dataValida(r[0]) ? r[0] : new Date(r[0]);
    if (!dataValida(dataOper)) continue;

    var placa = t[1] || "";
    var motorista = layoutNovo ? "" : (t[2] || "");
    var transportadora = layoutNovo ? (t[2] || "") : (t[3] || "");
    var destino = layoutNovo ? (t[3] || "") : (t[4] || "");
    var tipo = layoutNovo ? (t[4] || "") : (t[9] || "");
    if (!tipo) tipo = getTransbordo(destino) ? "Transbordo" : "Entrega";
    var limite = t[5] || getHorarioLimite(destino);
    var saiu = t[6] || "";
    var horaSaida = t[7] || "";
    var dataHoraSaida = ehSim(saiu) || horaSaida
      ? inferirDataHoraSaida(dataOper, horaSaida, limite) : null;
    var atrasoMin = r[8] === "" || r[8] === null ? 0 : Number(r[8]) || 0;
    var chegou = layoutNovo ? (t[9] || "") : (t[10] || "");
    var horaChegada = layoutNovo ? (t[10] || "") : (t[11] || "");
    var dataHoraChegada = ehSim(chegou) || horaChegada
      ? inferirDataHoraChegada(dataOper, horaChegada, dataHoraSaida) : null;
    var atualizado = layoutNovo && dataValida(r[11]) ? r[11] : "";

    migradas.push([
      Utilities.getUuid(), dataOper, placa, motorista, transportadora, destino, tipo,
      limite, saiu, horaSaida, dataHoraSaida || "", atrasoMin,
      chegou, horaChegada, dataHoraChegada || "", atualizado
    ]);
  }

  if (hist.getMaxColumns() < CABECALHO_HISTORICO.length) {
    hist.insertColumnsAfter(hist.getMaxColumns(), CABECALHO_HISTORICO.length - hist.getMaxColumns());
  }
  hist.clearContents();
  hist.getRange(1,1,1,CABECALHO_HISTORICO.length).setValues([CABECALHO_HISTORICO]);
  if (migradas.length) hist.getRange(2,1,migradas.length,CABECALHO_HISTORICO.length).setValues(migradas);
  hist.setFrozenRows(1);
  hist.getRange("B:B").setNumberFormat("dd/MM/yyyy");
  hist.getRange("K:K").setNumberFormat("dd/MM/yyyy HH:mm");
  hist.getRange("O:P").setNumberFormat("dd/MM/yyyy HH:mm");
  hist.hideColumns(1);
  hist.hideColumns(11);
  hist.hideColumns(15,2);
  return hist;
}

/* ============================================================
   LOGIN E FROTA
   ============================================================ */
function loginConta(conta) {
  var senha = PropertiesService.getScriptProperties().getProperty(conta.prop);
  if (!senha) { Logger.log("AVISO: senha não configurada para " + conta.nome); return null; }

  var resp = fetchComRetry(BASE_URL, {
    "method": "post",
    "payload": { "account": conta.account, "user": conta.user, "password": senha, "submit": "Login" },
    "followRedirects": true, "muteHttpExceptions": true
  }, 3);

  if (!resp) { Logger.log("Login falhou (timeout): " + conta.nome); return null; }
  if (resp.getContentText().indexOf("Conta ou Usu") !== -1) {
    Logger.log("Login recusado: " + conta.nome); return null;
  }
  var ch = resp.getAllHeaders()["Set-Cookie"] || resp.getAllHeaders()["set-cookie"];
  if (!ch) return null;
  return (Array.isArray(ch) ? ch : [ch]).map(function(c){ return c.split(";")[0]; }).join("; ");
}

function carregarFrotaConsolidada() {
  var frota = {};
  var hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd/23:59");

  CONTAS.forEach(function(conta){
    var cookies = loginConta(conta);
    if (!cookies) return;
    var url = BASE_URL + "?page=map.fleet&page_cmd=mapupd&date_fr=&date_to="
      + encodeURIComponent(hoje)
      + "&date_tz=" + encodeURIComponent("GMT-03:00") + "&group=all&limType=last";

    var resp = fetchComRetry(url, { "method":"get", "headers":{"Cookie":cookies}, "muteHttpExceptions":true }, 3);
    if (!resp) { Logger.log("Frota falhou: " + conta.nome); return; }

    var parcial = parseFleetXml(resp.getContentText());
    var novos = 0;
    Object.keys(parcial).forEach(function(p){
      if (frota[p]) return;
      parcial[p].cookies = cookies;
      frota[p] = parcial[p];
      novos++;
    });
    Logger.log(conta.nome + ": " + Object.keys(parcial).length + " veículos (" + novos + " novos)");
  });
  return frota;
}

function parseFleetXml(xml) {
  var frota = {};
  var regexDs = /<DataSet[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/DataSet>/g, mDs;
  while ((mDs = regexDs.exec(xml)) !== null) {
    var deviceId = (mDs[1] || "").trim().toLowerCase();
    var mP = mDs[2].match(/<P><!\[CDATA\[([\s\S]*?)\]\]><\/P>/);
    if (!mP) continue;
    var tk = mP[1].split("|");
    var placa = normalizarPlaca(tk[1]);
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) placa = normalizarPlaca(deviceId);
    if (!placa) continue;
    var end = mP[1].match(/"([^"]*)"/);
    frota[placa] = {
      deviceId: deviceId, status: tk[6] || "", hora: tk[4] || "",
      kph: tk[14] || "0", endereco: end ? end[1] : ""
    };
  }
  return frota;
}

function fetchComRetry(url, options, tentativas) {
  for (var i = 1; i <= tentativas; i++) {
    try { return UrlFetchApp.fetch(url, options); }
    catch (e) {
      Logger.log("Falhou tentativa " + i + ": " + e.message);
      if (i < tentativas) Utilities.sleep(2000);
    }
  }
  return null;
}

/* ============================================================
   EVENTOS — consulta a noite anterior e o dia operacional.
   A data completa acompanha cada evento; a virada da meia-noite
   deixa de transformar uma saída adiantada em atraso.
   ============================================================ */
function consultarEventosPeriodo(deviceId, cookies, dataRef, horaInicio, horaFim, transbordo) {
  var res = { partidas: [], chegadas: [], posicoes: [] };
  var d = Utilities.formatDate(dataRef, Session.getScriptTimeZone(), "yyyy/MM/dd");
  var url = BASE_URL + "?page=map.device&page_cmd=mapupd"
    + "&date_fr=" + encodeURIComponent(d + "/" + horaInicio)
    + "&date_to=" + encodeURIComponent(d + "/" + horaFim)
    + "&date_tz=" + encodeURIComponent("GMT-03:00")
    + "&device=" + String(deviceId).toLowerCase()
    + "&limit=1000&limType=first";

  var resp = fetchComRetry(url, { "method":"get", "headers":{"Cookie":cookies}, "muteHttpExceptions":true }, 2);
  if (!resp) return res;

  var regex = /<P><!\[CDATA\[([\s\S]*?)\]\]><\/P>/g, match;
  var xml = resp.getContentText();
  var dentroConsecutivos = 0, dentroDesde = null, chegadaConfirmada = false;

  while ((match = regex.exec(xml)) !== null) {
    var tk = match[1].split("|");
    var status = semAcento(tk[6]);
    var hora = (tk[4] || "").substring(0,5);
    var instante = combinarDataHora(dataRef, hora);
    if (!instante) continue;

    var lat = parseFloat(tk[8]), lon = parseFloat(tk[9]);
    var vel = parseFloat(tk[14]);
    if (!isNaN(lat) && !isNaN(lon)) {
      res.posicoes.push({
        hora: hora, dataHora: instante, lat: lat, lon: lon,
        velocidade: isNaN(vel) ? null : vel
      });
    }

    if (status.indexOf("partida") !== -1) {
      res.partidas.push({ hora: hora, dataHora: instante });
    }

    if (transbordo && transbordo.lat != null && !chegadaConfirmada) {
      if (isNaN(lat) || isNaN(lon)) continue;
      var dist = distanciaMetros(lat, lon, transbordo.lat, transbordo.lon);
      var dentro = dist <= (transbordo.raio || 400);

      if (!dentro) {
        dentroConsecutivos = 0;
        dentroDesde = null;
        continue;
      }

      dentroConsecutivos++;
      if (!dentroDesde) dentroDesde = instante;
      var velocidadeConhecida = !isNaN(vel);
      var parado = velocidadeConhecida && vel <= 3;
      var permanenciaMin = Math.round((instante.getTime() - dentroDesde.getTime()) / 60000);
      var permanenciaConfirmada = dentroConsecutivos >= 2 && permanenciaMin >= 2;

      if (parado || permanenciaConfirmada) {
        res.chegadas.push({ hora: hora, dataHora: instante, distancia: Math.round(dist) });
        chegadaConfirmada = true;
      }
    }
  }
  return res;
}

/* Confirma saída somente após o veículo ter sido visto dentro da base
   e registrar dois pontos consecutivos além do raio externo. */
function detectarSaidaBase(posicoes) {
  var ordenadas = (posicoes || []).slice().sort(function(a,b){
    return a.dataHora.getTime() - b.dataHora.getTime();
  });
  var viuDentro = false;
  var foraConsecutivos = 0;
  var primeiraFora = null;

  for (var i = 0; i < ordenadas.length; i++) {
    var p = ordenadas[i];
    var dist = distanciaMetros(p.lat, p.lon, BASE_GRF.lat, BASE_GRF.lon);

    if (dist <= BASE_GRF.raioEntrada) {
      viuDentro = true;
      foraConsecutivos = 0;
      primeiraFora = null;
      continue;
    }

    if (!viuDentro || dist < BASE_GRF.raioSaida) {
      foraConsecutivos = 0;
      primeiraFora = null;
      continue;
    }

    if (!primeiraFora) primeiraFora = p;
    foraConsecutivos++;
    if (foraConsecutivos >= BASE_GRF.pontosForaParaConfirmar) {
      return {
        hora: primeiraFora.hora,
        dataHora: primeiraFora.dataHora,
        distancia: Math.round(dist),
        origem: "Cerca GRF"
      };
    }
  }
  return null;
}

function buscarEventosNaJanela(deviceId, cookies, dataOper, transbordo, dataHoraSaidaConhecida) {
  var vazio = { partida: null, chegada: null };
  if (!dataOper || !cookies || !deviceId) return vazio;

  var diaAnterior = copiarData(dataOper);
  diaAnterior.setDate(diaAnterior.getDate() - 1);
  var anterior = consultarEventosPeriodo(deviceId, cookies, diaAnterior, "18:00", "23:59", transbordo);
  var operacional = consultarEventosPeriodo(deviceId, cookies, dataOper, "00:00", "23:59", transbordo);

  var partidas = anterior.partidas.concat(operacional.partidas).sort(function(a,b){
    return a.dataHora.getTime() - b.dataHora.getTime();
  });
  var saidaCerca = detectarSaidaBase(anterior.posicoes.concat(operacional.posicoes));
  var partida = dataHoraSaidaConhecida
    ? { hora: Utilities.formatDate(dataHoraSaidaConhecida, Session.getScriptTimeZone(), "HH:mm"), dataHora: dataHoraSaidaConhecida }
    : (saidaCerca || partidas[0] || null);

  var chegadas = anterior.chegadas.concat(operacional.chegadas).sort(function(a,b){
    return a.dataHora.getTime() - b.dataHora.getTime();
  });
  var referenciaSaida = partida ? partida.dataHora : null;
  var chegada = null;
  for (var i = 0; i < chegadas.length; i++) {
    if (!referenciaSaida || chegadas[i].dataHora >= referenciaSaida) {
      chegada = chegadas[i];
      break;
    }
  }
  return { partida: partida, chegada: chegada };
}
/* ============================================================
   HISTÓRICO — espelha todas as linhas das datas presentes na
   Programação. Datas antigas são preservadas; a data atual é
   reconstruída, eliminando sobras e colisões por placa.
   ============================================================ */
function registroParaHistorico(l) {
  return [
    l.idViagem, l.dataOperacional, l.placa, l.motorista || "",
    l.transportadora, l.destino, l.tipo, l.horarioLimite,
    l.saiu, l.horaSaida, l.dataHoraSaida || "", l.atrasoMin,
    l.chegou, l.horaChegada, l.dataHoraChegada || "", new Date()
  ];
}

function sincronizarHistorico(ss, registros) {
  var hist = prepararHistorico(ss);
  var datasAtivas = {};
  registros.forEach(function(l){
    var chave = chaveData(l.dataOperacional);
    if (chave) datasAtivas[chave] = true;
  });

  var lastRow = hist.getLastRow();
  var existentes = lastRow > 1
    ? hist.getRange(2,1,lastRow-1,CABECALHO_HISTORICO.length).getValues()
    : [];
  var mantidas = existentes.filter(function(r){
    return !datasAtivas[chaveData(r[1])];
  });
  var atuais = registros.filter(function(l){ return !!l.dataOperacional; }).map(registroParaHistorico);
  var todas = mantidas.concat(atuais);

  if (hist.getMaxRows() > 1) {
    hist.getRange(2,1,hist.getMaxRows()-1,CABECALHO_HISTORICO.length).clearContent();
  }
  if (todas.length) hist.getRange(2,1,todas.length,CABECALHO_HISTORICO.length).setValues(todas);
  hist.getRange("B:B").setNumberFormat("dd/MM/yyyy");
  hist.getRange("K:K").setNumberFormat("dd/MM/yyyy HH:mm");
  hist.getRange("O:P").setNumberFormat("dd/MM/yyyy HH:mm");
}

/* ============================================================
   FUNÇÃO PRINCIPAL
   Regra: uma vez "Sim", nunca volta pra "Não".
   ============================================================ */
function atualizarStatusFrota() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log("Outra atualização já está em andamento."); return; }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(ABA);
    garantirColunasTecnicas(sheet);
    prepararHistorico(ss);
    var col = mapearColunas(sheet);

    var faltando = [];
    ["data","placa","destino","saiu","horaSaida","idViagem","dataHoraSaida","dataHoraChegada"].forEach(function(c){
      if (!col[c]) faltando.push(c);
    });
    if (faltando.length) { Logger.log("ERRO: colunas faltando: " + faltando.join(", ") + ". Rode configurarPlanilha()."); return; }

    /* O Histórico não pode depender da resposta do GPS. Se ele tiver sido
       limpo, é reconstruído imediatamente a partir da Programação. */
    sincronizarHistorico(ss, coletarRegistrosProgramacao(ss));

    var frota = carregarFrotaConsolidada();
    if (Object.keys(frota).length === 0) { Logger.log("Nenhuma conta respondeu. Abortando."); return; }
    Logger.log("TOTAL consolidado: " + Object.keys(frota).length + " veículos");

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) { Logger.log("Planilha sem dados."); return; }

    var faixa = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    var textos = faixa.getDisplayValues();
    var valores = faixa.getValues();
    var registros = [];
    var nPartidas = 0, nChegadas = 0, nSemGps = 0;

    function ler(t, chave){ return col[chave] ? (t[col[chave]-1] || "") : ""; }
    function lerRaw(v, chave){ return col[chave] ? v[col[chave]-1] : ""; }
    function escrever(linha, chave, valor){ if (col[chave]) sheet.getRange(linha, col[chave]).setValue(valor); }

    for (var i = 0; i < textos.length; i++) {
      var t = textos[i], v = valores[i];
      if (!ler(t, "placa")) continue;

      var linha = i + 2;
      var placa = normalizarPlaca(String(ler(t,"placa")).split(/[\s\[]/)[0]);
      var destino = ler(t, "destino");
      var dataOper = dataOperacionalDeTexto(ler(t, "data"));
      if (!dataOper) { Logger.log("Data inválida na linha " + linha); continue; }
      var dados = frota[placa];
      var transbordo = getTransbordo(destino);
      var tipo = transbordo ? "Transbordo" : "Entrega";
      var horarioLimite = getHorarioLimite(destino);
      var dataLimite = dataHoraPrevista(dataOper, horarioLimite);

      var idViagem = ler(t, "idViagem");
      if (!idViagem) {
        idViagem = Utilities.getUuid();
        escrever(linha, "idViagem", idViagem);
      }

      var horaSaida = ler(t, "horaSaida");
      var dataHoraSaida = lerRaw(v, "dataHoraSaida");
      if (!dataValida(dataHoraSaida) && horaSaida) {
        dataHoraSaida = inferirDataHoraSaida(dataOper, horaSaida, horarioLimite);
      }
      var jaSaiu = ehSim(ler(t, "saiu")) || !!horaSaida || dataValida(dataHoraSaida);
      if (jaSaiu && !horaSaida && dataValida(dataHoraSaida)) {
        horaSaida = Utilities.formatDate(dataHoraSaida, Session.getScriptTimeZone(), "HH:mm");
      }

      var horaChegada = ler(t, "horaChegada");
      var dataHoraChegada = lerRaw(v, "dataHoraChegada");
      if (!dataValida(dataHoraChegada) && horaChegada) {
        dataHoraChegada = inferirDataHoraChegada(dataOper, horaChegada, dataHoraSaida);
      }
      var jaChegou = ehSim(ler(t, "chegou")) || !!horaChegada || dataValida(dataHoraChegada);
      if (jaChegou && !horaChegada && dataValida(dataHoraChegada)) {
        horaChegada = Utilities.formatDate(dataHoraChegada, Session.getScriptTimeZone(), "HH:mm");
      }

      var saiu = jaSaiu ? "Sim" : "Não";
      var chegou = jaChegou ? "Sim" : (transbordo ? "Não" : "");

      if (!dados) {
        if (!jaSaiu) { nSemGps++; escrever(linha, "statusGPS", "Não encontrado"); }
      } else {
        escrever(linha, "statusGPS", dados.status.trim());
        escrever(linha, "ultimaPosicao", dados.endereco);

        var precisaPartida = !jaSaiu;
        var precisaChegada = !!transbordo && !jaChegou;
        if (precisaPartida || precisaChegada) {
          var ev = buscarEventosNaJanela(dados.deviceId || placa, dados.cookies, dataOper,
                                         precisaChegada ? transbordo : null, dataHoraSaida);
          if (precisaPartida && ev.partida) {
            saiu = "Sim";
            horaSaida = ev.partida.hora;
            dataHoraSaida = ev.partida.dataHora;
            nPartidas++;
            escrever(linha, "saiu", saiu);
            escrever(linha, "horaSaida", "'" + horaSaida);
            escrever(linha, "dataHoraSaida", dataHoraSaida);
          }
          if (precisaChegada && ev.chegada) {
            chegou = "Sim";
            horaChegada = ev.chegada.hora;
            dataHoraChegada = ev.chegada.dataHora;
            nChegadas++;
            escrever(linha, "chegou", chegou);
            escrever(linha, "horaChegada", "'" + horaChegada);
            escrever(linha, "dataHoraChegada", dataHoraChegada);
          }
        }
      }

      if (!jaSaiu && saiu === "Não") escrever(linha, "saiu", "Não");
      if (transbordo && !jaChegou && chegou === "Não") escrever(linha, "chegou", "Não");
      if (dataValida(dataHoraSaida)) escrever(linha, "dataHoraSaida", dataHoraSaida);
      if (dataValida(dataHoraChegada)) escrever(linha, "dataHoraChegada", dataHoraChegada);

      var referencia = saiu === "Sim" && dataValida(dataHoraSaida) ? dataHoraSaida : new Date();
      var atrasoMin = calcularAtrasoMin(dataLimite, referencia);
      if (saiu !== "Sim" && atrasoMin < 0) atrasoMin = 0;
      escrever(linha, "horarioLimite", "'" + horarioLimite);
      escrever(linha, "atraso", formatarAtraso(atrasoMin));

      registros.push({
        idViagem: idViagem, dataOperacional: dataOper, placa: placa, motorista: "",
        transportadora: ler(t,"transportadora"), destino: destino, tipo: tipo,
        horarioLimite: horarioLimite, saiu: saiu, horaSaida: horaSaida,
        dataHoraSaida: dataHoraSaida, atrasoMin: atrasoMin,
        chegou: chegou, horaChegada: horaChegada, dataHoraChegada: dataHoraChegada
      });
    }

    sincronizarHistorico(ss, registros);
    Logger.log("Concluído. Partidas: " + nPartidas + " | Chegadas: " + nChegadas + " | Sem GPS: " + nSemGps);
  } finally {
    lock.releaseLock();
  }
}

/* Lê o estado atual sem consultar o GPS. Usado pelo gatilho de edição
   para refletir imediatamente qualquer ajuste manual no Histórico. */
function coletarRegistrosProgramacao(ss) {
  var sheet = ss.getSheetByName(ABA);
  garantirColunasTecnicas(sheet);
  var col = mapearColunas(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var faixa = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn());
  var textos = faixa.getDisplayValues();
  var valores = faixa.getValues();
  var registros = [];
  function ler(t, chave){ return col[chave] ? (t[col[chave]-1] || "") : ""; }
  function lerRaw(v, chave){ return col[chave] ? v[col[chave]-1] : ""; }

  for (var i = 0; i < textos.length; i++) {
    var t = textos[i], v = valores[i], linha = i + 2;
    if (!ler(t,"placa")) continue;
    var dataOper = dataOperacionalDeTexto(ler(t,"data"));
    if (!dataOper) continue;
    var destino = ler(t,"destino");
    var horarioLimite = getHorarioLimite(destino);
    var dataLimite = dataHoraPrevista(dataOper, horarioLimite);
    var idViagem = ler(t,"idViagem");
    if (!idViagem) {
      idViagem = Utilities.getUuid();
      sheet.getRange(linha,col.idViagem).setValue(idViagem);
    }

    var horaSaida = ler(t,"horaSaida");
    var dataHoraSaida = lerRaw(v,"dataHoraSaida");
    if (!dataValida(dataHoraSaida) && horaSaida) dataHoraSaida = inferirDataHoraSaida(dataOper,horaSaida,horarioLimite);
    var saiu = ehSim(ler(t,"saiu")) || !!horaSaida || dataValida(dataHoraSaida) ? "Sim" : "Não";
    if (saiu === "Sim" && !horaSaida && dataValida(dataHoraSaida)) {
      horaSaida = Utilities.formatDate(dataHoraSaida,Session.getScriptTimeZone(),"HH:mm");
    }

    var horaChegada = ler(t,"horaChegada");
    var dataHoraChegada = lerRaw(v,"dataHoraChegada");
    if (!dataValida(dataHoraChegada) && horaChegada) dataHoraChegada = inferirDataHoraChegada(dataOper,horaChegada,dataHoraSaida);
    var transbordo = getTransbordo(destino);
    var chegouConfirmado = ehSim(ler(t,"chegou")) || !!horaChegada || dataValida(dataHoraChegada);
    var chegou = chegouConfirmado ? "Sim" : (transbordo ? "Não" : "");
    if (chegou === "Sim" && !horaChegada && dataValida(dataHoraChegada)) {
      horaChegada = Utilities.formatDate(dataHoraChegada,Session.getScriptTimeZone(),"HH:mm");
    }

    var referencia = saiu === "Sim" && dataValida(dataHoraSaida) ? dataHoraSaida : new Date();
    var atrasoMin = calcularAtrasoMin(dataLimite,referencia);
    if (saiu !== "Sim" && atrasoMin < 0) atrasoMin = 0;

    if (saiu === "Sim" && !ehSim(ler(t,"saiu"))) sheet.getRange(linha,col.saiu).setValue("Sim");
    if (chegou === "Sim" && col.chegou && !ehSim(ler(t,"chegou"))) sheet.getRange(linha,col.chegou).setValue("Sim");
    if (dataValida(dataHoraSaida)) sheet.getRange(linha,col.dataHoraSaida).setValue(dataHoraSaida);
    if (dataValida(dataHoraChegada)) sheet.getRange(linha,col.dataHoraChegada).setValue(dataHoraChegada);
    if (col.horarioLimite) sheet.getRange(linha,col.horarioLimite).setValue("'" + horarioLimite);
    if (col.atraso) sheet.getRange(linha,col.atraso).setValue(formatarAtraso(atrasoMin));

    registros.push({
      idViagem: idViagem, dataOperacional: dataOper,
      placa: normalizarPlaca(String(ler(t,"placa")).split(/[\s\[]/)[0]),
      motorista: "", transportadora: ler(t,"transportadora"), destino: destino,
      tipo: transbordo ? "Transbordo" : "Entrega", horarioLimite: horarioLimite,
      saiu: saiu, horaSaida: horaSaida, dataHoraSaida: dataHoraSaida,
      atrasoMin: atrasoMin, chegou: chegou, horaChegada: horaChegada,
      dataHoraChegada: dataHoraChegada
    });
  }
  return registros;
}

function sincronizarHistoricoAgora() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    sincronizarHistorico(ss, coletarRegistrosProgramacao(ss));
  } finally {
    lock.releaseLock();
  }
}

/* Pode ser executada manualmente sempre que a aba Histórico for limpa. */
function reconstruirHistorico() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Outra atualização está em andamento. Tente novamente em 1 minuto.");
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var registros = coletarRegistrosProgramacao(ss);
    Logger.log("Linhas encontradas na Programação: " + registros.length);
    if (!registros.length) {
      throw new Error("Nenhuma linha válida encontrada na aba Programação. Confira Data, Placa e Cidade/Rota.");
    }
    sincronizarHistorico(ss, registros);
    SpreadsheetApp.flush();
    var hist = ss.getSheetByName("Histórico");
    var gravadas = Math.max(hist.getLastRow() - 1, 0);
    Logger.log("Linhas existentes no Histórico após reconstrução: " + gravadas);
    if (!gravadas) throw new Error("O Histórico permaneceu vazio após a gravação.");
  } finally {
    lock.releaseLock();
  }
}

function aoEditarProgramacao(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== ABA || e.range.getRow() === 1) return;
  sincronizarHistoricoAgora();
}

function aoAlterarEstrutura(e) {
  if (!e || ["INSERT_ROW","REMOVE_ROW","INSERT_COLUMN","REMOVE_COLUMN"].indexOf(e.changeType) === -1) return;
  sincronizarHistoricoAgora();
}

/* Rodar uma vez depois de publicar esta versão. */
function instalarGatilhos() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ScriptApp.getProjectTriggers().forEach(function(t){
    var fn = t.getHandlerFunction();
    if (fn === "atualizarStatusFrota" || fn === "aoEditarProgramacao" || fn === "aoAlterarEstrutura") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("atualizarStatusFrota").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("aoEditarProgramacao").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("aoAlterarEstrutura").forSpreadsheet(ss).onChange().create();
  Logger.log("Gatilhos instalados: atualização a cada 5 min + sincronização por edição/estrutura.");
}

/* ============================================================
   PORTA DE SAÍDA PARA O PAINEL
   ============================================================ */
function doGet(e) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ABA);
  var col = mapearColunas(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }
  var faixa = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  var textos = faixa.getDisplayValues();
  var valores = faixa.getValues();
  var out = [];
  textos.forEach(function(t, indice){
    var raw = valores[indice];
    function v(c){ return col[c] ? (t[col[c]-1] || "") : ""; }
    function vr(c){ return col[c] ? raw[col[c]-1] : ""; }
    if (!v("placa")) return;
    var destino = v("destino");
    var tb = getTransbordo(destino);
    var dataOper = dataOperacionalDeTexto(v("data"));
    var horarioLimite = v("horarioLimite") || getHorarioLimite(destino);
    var dataLimite = dataHoraPrevista(dataOper, horarioLimite);
    var horaSaida = v("horaSaida");
    var dataHoraSaida = vr("dataHoraSaida");
    if (!dataValida(dataHoraSaida) && horaSaida) {
      dataHoraSaida = inferirDataHoraSaida(dataOper, horaSaida, horarioLimite);
    }
    var saiu = ehSim(v("saiu")) || !!horaSaida || dataValida(dataHoraSaida);
    var horaChegada = v("horaChegada");
    var dataHoraChegada = vr("dataHoraChegada");
    if (!dataValida(dataHoraChegada) && horaChegada) {
      dataHoraChegada = inferirDataHoraChegada(dataOper, horaChegada, dataHoraSaida);
    }
    var chegou = ehSim(v("chegou")) || !!horaChegada || dataValida(dataHoraChegada);
    var referencia = saiu && dataValida(dataHoraSaida) ? dataHoraSaida : new Date();
    var atrasoMin = calcularAtrasoMin(dataLimite, referencia);
    if (!saiu && atrasoMin < 0) atrasoMin = 0;
    out.push({
      placa: normalizarPlaca(String(v("placa")).split(/[\s\[]/)[0]),
      destino: destino,
      transportadora: v("transportadora"),
      tipo: tb ? "Transbordo" : "Entrega",
      pontoApoio: tb ? tb.nome : null,
      saiu: saiu,
      horaSaida: horaSaida || null,
      statusGPS: v("statusGPS") || null,
      horarioLimite: horarioLimite,
      atraso: formatarAtraso(atrasoMin),
      atrasoMin: atrasoMin,
      statusPrazo: atrasoMin > 0 ? "Atrasado" : "No prazo",
      dataOperacional: isoOuNull(dataOper),
      saidaPrevistaEm: isoOuNull(dataLimite),
      saidaRealEm: isoOuNull(dataHoraSaida),
      chegou: chegou,
      horaChegada: horaChegada || null,
      chegadaRealEm: isoOuNull(dataHoraChegada)
    });
  });
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   DIAGNÓSTICOS
   ============================================================ */
function verCabecalhos() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ABA);
  var cab = sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),1)).getDisplayValues()[0];
  cab.forEach(function(n,i){ Logger.log((i+1) + " → " + (n || "[vazia]")); });
  Logger.log("MAPA: " + JSON.stringify(mapearColunas(sheet)));
}

function diagnosticarTransbordos() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ABA);
  var col = mapearColunas(sheet);
  var lastRow = sheet.getLastRow();
  var dest = sheet.getRange(2, col.destino, lastRow-1, 1).getDisplayValues();
  var vistos = {};
  dest.forEach(function(d){
    if (!d[0] || vistos[d[0]]) return;
    vistos[d[0]] = true;
    var tb = getTransbordo(d[0]);
    Logger.log((tb ? "🔄 TRANSBORDO" : "📦 Entrega  ") + " | " + d[0]
      + " | limite " + getHorarioLimite(d[0])
      + (tb ? " → " + tb.nome + (tb.lat == null ? " (SEM COORDENADA!)" : " (raio " + tb.raio + "m)") : ""));
  });
}

/* Calibra o raio: mostra a aproximação máxima do veículo ao ponto */
function diagnosticarChegada() {
  var PLACA = "SYE1F59";
  var DATA  = "2026/08/06";

  var frota = carregarFrotaConsolidada();
  var dados = frota[normalizarPlaca(PLACA)];
  if (!dados) { Logger.log("Placa não encontrada."); return; }

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ABA);
  var col = mapearColunas(sheet);
  var textos = sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getDisplayValues();
  var destino = "";
  textos.forEach(function(t){
    if (normalizarPlaca(String(t[col.placa-1]).split(/[\s\[]/)[0]) === normalizarPlaca(PLACA)) destino = t[col.destino-1];
  });
  var tb = getTransbordo(destino);
  Logger.log("Placa " + PLACA + " | destino: " + destino + " | ponto: " + (tb ? tb.nome : "não é transbordo"));
  if (!tb || tb.lat == null) return;

  var url = BASE_URL + "?page=map.device&page_cmd=mapupd"
    + "&date_fr=" + encodeURIComponent(DATA + "/00:00")
    + "&date_to=" + encodeURIComponent(DATA + "/23:59")
    + "&date_tz=" + encodeURIComponent("GMT-03:00")
    + "&device=" + dados.deviceId + "&limit=1000&limType=first";

  var resp = fetchComRetry(url, { "method":"get", "headers":{"Cookie":dados.cookies}, "muteHttpExceptions":true }, 2);
  if (!resp) { Logger.log("Consulta falhou."); return; }

  var regex = /<P><!\[CDATA\[([\s\S]*?)\]\]><\/P>/g, match;
  var xml = resp.getContentText();
  var menor = 999999, horaMenor = "", total = 0, dentro = [];

  while ((match = regex.exec(xml)) !== null) {
    var tk = match[1].split("|");
    var lat = parseFloat(tk[8]), lon = parseFloat(tk[9]);
    if (isNaN(lat) || isNaN(lon)) continue;
    total++;
    var dist = distanciaMetros(lat, lon, tb.lat, tb.lon);
    if (dist < menor) { menor = dist; horaMenor = (tk[4]||"").substring(0,5); }
    if (dist <= tb.raio) dentro.push((tk[4]||"").substring(0,5) + " (" + Math.round(dist) + "m)");
  }

  Logger.log("Posições analisadas: " + total);
  Logger.log("Aproximação máxima: " + Math.round(menor) + "m às " + horaMenor);
  Logger.log("Raio configurado: " + tb.raio + "m");
  Logger.log("Dentro do raio: " + (dentro.length ? dentro.slice(0,5).join(", ") : "NENHUMA"));
}
