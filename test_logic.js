const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const context = {
  console,
  Date,
  Math,
  JSON,
  Object,
  String,
  Number,
  Array,
  RegExp,
  parseInt,
  parseFloat,
  isNaN,
  encodeURIComponent,
  Utilities: {
    formatDate(date, _tz, pattern) {
      const pad = n => String(n).padStart(2, "0");
      if (pattern === "yyyy-MM-dd") return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
      if (pattern === "HH:mm") return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      return "";
    },
    getUuid() { return "uuid-teste"; }
  },
  Session: { getScriptTimeZone() { return "America/Sao_Paulo"; } }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("repo/Code.gs", "utf8"), context, { filename: "Code.gs" });

function desvio(destino, hora) {
  const dataOper = new Date(2026, 7, 12, 12, 0, 0);
  const limite = context.getHorarioLimite(destino);
  const prevista = context.dataHoraPrevista(dataOper, limite);
  const real = context.inferirDataHoraSaida(dataOper, hora, limite);
  return context.calcularAtrasoMin(prevista, real);
}

assert.strictEqual(context.getHorarioLimite("CAMPOS"), "00:00");
assert.strictEqual(context.getHorarioLimite("ANGRA DOS REIS"), "00:00");
assert.strictEqual(context.getHorarioLimite("CABO FRIO"), "00:00");
assert.strictEqual(desvio("CAMPOS", "21:35"), -145);
assert.strictEqual(desvio("ANGRA", "21:43"), -137);
assert.strictEqual(desvio("CABO FRIO", "22:54"), -66);
assert.strictEqual(desvio("PETROPOLIS", "21:48"), -492);
assert.strictEqual(desvio("TERESOPOLIS", "06:48"), 108);
assert.strictEqual(context.ehSim(" SIM "), true);
assert.strictEqual(context.ehSim("x"), true);
assert.strictEqual(context.ehSim("Não"), false);

console.log("Todos os testes de horário e virada de dia passaram.");
