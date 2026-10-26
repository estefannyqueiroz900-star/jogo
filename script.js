
const $ = id => document.getElementById(id);

const telaInicio = $("telaInicio");
const telaJogo = $("telaJogo");
const telaResultado = $("telaResultado");
const tabuleiro = $("tabuleiro");

const TOTAL_PARES = 16;
const TEMPO_INICIAL = 90;

const elencoReserva = [
  "Patrick Jane", "Teresa Lisbon", "Kimball Cho", "Wayne Rigsby",
  "Grace Van Pelt", "Red John", "Dennis Abbott", "Kim Fischer",
  "J.J. LaRoche", "Virgil Minelli", "Madeleine Hightower",
  "Brett Partridge", "Walter Mashburn", "Kristina Frye",
  "Gale Bertram", "Ray Haffner"
];

let cartasViradas = [];
let paresEncontrados = 0;
let pontos = 0;
let tentativas = 0;
let tempoRestante = TEMPO_INICIAL;
let intervalo = null;
let temporizadorErro = null;
let bloqueado = false;
let rodada = 0;

function mostrarTela(tela) {
  [telaInicio, telaJogo, telaResultado].forEach(el => {
    el.classList.remove("ativa");
  });
  tela.classList.add("ativa");
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Busca o elenco pelo nome da série
async function carregarElenco() {
  const resposta = await fetch(
    "https://api.tvmaze.com/singlesearch/shows?q=The%20Mentalist&embed=cast"
  );

  if (!resposta.ok) throw new Error("A API não respondeu.");

  const serie = await resposta.json();
  const elenco = serie._embedded?.cast || [];

  const lista = elenco
    .filter(item => item.person?.image?.medium)
    .map(item => ({
      nome: item.character?.name || item.person.name,
      imagem: item.person.image.original || item.person.image.medium
    }));

  const unicos = [];
  const nomes = new Set();

  for (const personagem of lista) {
    const chave = personagem.nome.toLowerCase();
    if (!nomes.has(chave)) {
      nomes.add(chave);
      unicos.push(personagem);
    }
  }

  if (unicos.length < TOTAL_PARES) {
    throw new Error("Elenco insuficiente.");
  }

  return embaralhar(unicos).slice(0, TOTAL_PARES);
}

function atualizarPainel() {
  $("pares").textContent = `${paresEncontrados}/${TOTAL_PARES}`;
  $("pontos").textContent = pontos;
  $("tentativas").textContent = tentativas;

  const minutos = Math.floor(tempoRestante / 60);
  const segundos = tempoRestante % 60;

  $("tempo").textContent =
    `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

function criarCarta(personagem, id) {
  const carta = document.createElement("button");
  carta.type = "button";
  carta.className = "carta";
  carta.dataset.par = id;
  carta.setAttribute("aria-label", "Carta escondida");

  const interno = document.createElement("span");
  interno.className = "interno";

  const frente = document.createElement("span");
  frente.className = "frente";
  frente.textContent = "?";

  const verso = document.createElement("span");
  verso.className = "verso";

  const imagem = document.createElement("img");
  imagem.alt = personagem.nome;
  imagem.loading = "eager";

  // A foto é atribuída somente depois de montar a carta.
  if (personagem.imagem) {
    imagem.src = personagem.imagem;
  } else {
    imagem.style.display = "none";
  }

  const nome = document.createElement("span");
  nome.className = "nome-personagem";
  nome.textContent = personagem.nome;

  imagem.addEventListener("error", () => {
    imagem.style.display = "none";
    nome.textContent = personagem.nome + " (foto indisponível)";
  });

  verso.append(imagem, nome);
  interno.append(frente, verso);
  carta.append(interno);

  carta.addEventListener("click", () => virarCarta(carta));

  return carta;
}

function prepararCartas(elenco) {
  tabuleiro.innerHTML = "";

  // Se a API falhar, permite jogar com as cartas de reserva.
  const personagens = elenco || elencoReserva.map(nome => ({
    nome,
    imagem: ""
  }));

  const pares = personagens.map((p, id) => ({ ...p, id }));
  const cartas = embaralhar([...pares, ...pares]);

  cartas.forEach(personagem => {
    tabuleiro.appendChild(criarCarta(personagem, personagem.id));
  });
}

async function iniciarJogo() {
  clearInterval(intervalo);
  clearTimeout(temporizadorErro);

  rodada++;
  const rodadaAtual = rodada;

  cartasViradas = [];
  paresEncontrados = 0;
  pontos = 0;
  tentativas = 0;
  tempoRestante = TEMPO_INICIAL;
  bloqueado = true;

  mostrarTela(telaJogo);
  $("status").textContent = "Carregando arquivos da investigação...";
  tabuleiro.innerHTML = "";
  atualizarPainel();

  let elenco = null;

  try {
    elenco = await carregarElenco();
  } catch (erro) {
    console.error("Não foi possível carregar as fotos:", erro);
  }

  if (rodadaAtual !== rodada) return;

  prepararCartas(elenco);
  bloqueado = false;

  $("status").textContent = elenco
    ? "Elenco carregado. Encontre os 16 pares!"
    : "Modo de reserva: as fotos não carregaram. Confira sua internet.";

  atualizarPainel();

  intervalo = setInterval(() => {
    if (rodadaAtual !== rodada) return;

    tempoRestante--;
    atualizarPainel();

    if (tempoRestante <= 0) finalizarJogo(false);
  }, 1000);
}

function virarCarta(carta) {
  if (
    bloqueado ||
    carta.classList.contains("revelada") ||
    carta.classList.contains("acertada")
  ) return;

  carta.classList.add("revelada");
  cartasViradas.push(carta);

  if (cartasViradas.length < 2) return;

  tentativas++;

  const [a, b] = cartasViradas;
  bloqueado = true;

  if (a.dataset.par === b.dataset.par) {
    a.classList.add("acertada");
    b.classList.add("acertada");
    a.disabled = true;
    b.disabled = true;

    paresEncontrados++;
    pontos += 100;
    cartasViradas = [];
    bloqueado = false;
    atualizarPainel();

    if (paresEncontrados === TOTAL_PARES) {
      finalizarJogo(true);
    }
  } else {
    pontos = Math.max(0, pontos - 20);
    atualizarPainel();

    const rodadaAtual = rodada;

    temporizadorErro = setTimeout(() => {
      if (rodadaAtual !== rodada) return;

      a.classList.remove("revelada");
      b.classList.remove("revelada");
      cartasViradas = [];
      bloqueado = false;
    }, 850);
  }
}

function finalizarJogo(venceu) {
  clearInterval(intervalo);
  clearTimeout(temporizadorErro);

  rodada++;
  bloqueado = true;

  mostrarTela(telaResultado);

  $("tituloResultado").textContent = venceu
    ? "CASO ENCERRADO"
    : "INVESTIGAÇÃO INTERROMPIDA";

  $("mensagemResultado").textContent = venceu
    ? "Você encontrou todos os pares antes que o tempo acabasse."
    : "O tempo acabou. Revise as pistas e tente novamente.";

  $("pontuacaoFinal").textContent =
    `Pontuação: ${pontos} | Pares: ${paresEncontrados}/16 | Tentativas: ${tentativas}`;
}

function voltarAoInicio() {
  clearInterval(intervalo);
  clearTimeout(temporizadorErro);
  rodada++;
  mostrarTela(telaInicio);
}

$("btnJogar").addEventListener("click", iniciarJogo);
$("btnReiniciar").addEventListener("click", iniciarJogo);
$("btnNovamente").addEventListener("click", iniciarJogo);
$("btnVoltarInicio").addEventListener("click", voltarAoInicio);
$("btnVoltarResultado").addEventListener("click", voltarAoInicio);
