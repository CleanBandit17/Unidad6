// ========================================================
// MOMENTUM & TANGENTE - INSTRUMENTO VISUAL GENERATIVO
// ========================================================

// Paletas de Espacio Exterior
const PALETA_CLARA = {
  fondo: '#D3D6D6',   // Carta Astronómica Vintage (Gris Hueso)
  trazo: '#1E2A38',   // Azul Grafito Táctico
  acento: '#B23B2B',  // Rojo Óxido
  detalle: '#D99B26'  // Amarillo Mostaza
};

const PALETA_OSCURA = {
  fondo: '#090D14',   // Abismo Estelar Profundo
  trazo: '#EAF2F8',   // Plata / Estelar
  acento: '#FF2A55',  // Rojo Fosforescente / Alarma
  detalle: '#00F0FF'  // Cian Foton
};

// Variables de Estado y Transición
let factorOscuro = 0.0;       // 0.0 = Espacio Claro, 1.0 = Espacio Oscuro
let targetFactorOscuro = 0.0;
let colFondo, colTrazo, colAcento, colDetalle;

let agentes = [];
let atractor;
let physarumBuffer;
let estrellasFijas = []; // Micro-estrellas para el fondo espacial

// Variables de Control Calibradas
let paramFriccion = 0.94;        
let paramFlocking = 1.0;
let paramPhysarumDecay = 20;     
let modoBurst = false;
let hudVisible = true;
let audioIniciado = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  physarumBuffer = createGraphics(width, height);
  actualizarColoresDinamicos();
  physarumBuffer.background(colFondo);

  atractor = createVector(width / 2, height / 2);

  // Generar Mapa de Micro-Estrellas Estáticas Fijas
  for (let i = 0; i < 160; i++) {
    estrellasFijas.push({
      x: random(width),
      y: random(height),
      tamano: random(0.8, 2.2),
      alfaBase: random(80, 200)
    });
  }

  // Generar Población (10% Naves Guía, 90% Escuadra)
  let totalAgentes = 110;
  for (let i = 0; i < totalAgentes; i++) {
    let esGuia = i < Math.floor(totalAgentes * 0.10);
    agentes.push(new Agente(random(width), random(height), esGuia));
  }

  configurarInterfazDOM();
}

function draw() {
  // 1. Transición suave del entorno espacial (Claro <-> Oscuro)
  factorOscuro = lerp(factorOscuro, targetFactorOscuro, 0.03);
  actualizarColoresDinamicos();

  // 2. Evaporación de Physarum con mantenimiento del vacío
  physarumBuffer.push();
  let alphaDecay = map(paramPhysarumDecay, 5, 80, 6, 38);
  physarumBuffer.fill(red(colFondo), green(colFondo), blue(colFondo), alphaDecay);
  physarumBuffer.noStroke();
  physarumBuffer.rect(0, 0, width, height);
  physarumBuffer.pop();

  // Renderizar estela Physarum de fondo
  image(physarumBuffer, 0, 0);

  // 3. Dibujar Fondo Espacial Minimalista (Radar / Coordenadas / Estrellas Adaptativas)
  dibujarFondoEspacial();

  // 4. Dibujar Atractor / Centro Gravitatorio
  dibujarAtractor();

  // 5. Actualizar Agentes (Naves)
  for (let agente of agentes) {
    if (!modoBurst) {
      agente.aplicarSteeringOrbital(atractor);
      agente.aplicarFlowFieldVortice(atractor);
      agente.aplicarFlockingCompleto(agentes);
    } else {
      agente.aplicarInerciaTangencial();
    }

    agente.actualizar();
    agente.depositarPhysarum(physarumBuffer);
    agente.dibujar();
  }
}

// --------------------------------------------------------
// FONDO ESPACIAL DINÁMICO (RADAR Y ESTRELLAS EN CLARO Y OSCURO)
// --------------------------------------------------------
function dibujarFondoEspacial() {
  push();
  
  // A. Retícula de Radar Adaptativa según la Luz del Espacio
  let alphaRadar = map(factorOscuro, 0, 1, 40, 65);
  stroke(red(colTrazo), green(colTrazo), blue(colTrazo), alphaRadar);
  strokeWeight(0.75);
  noFill();
  
  // Anillos concéntricos del radar
  circle(width / 2, height / 2, width * 0.35);
  circle(width / 2, height / 2, width * 0.70);
  
  // Ejes de coordenadas
  line(width / 2, 0, width / 2, height);
  line(0, height / 2, width, height / 2);

  // Marcas técnicas en los ejes
  let pasoMarca = 60;
  for (let x = width / 2 % pasoMarca; x < width; x += pasoMarca) {
    line(x, height / 2 - 3, x, height / 2 + 3);
  }
  for (let y = height / 2 % pasoMarca; y < height; y += pasoMarca) {
    line(width / 2 - 3, y, width / 2 + 3, y);
  }

  // B. Micro-Estrellas Fijas Adaptativas (Visibles en Claro y Oscuro)
  noStroke();
  for (let est of estrellasFijas) {
    // Opacidad calculada dinámicamente para que destaquen en ambos escenarios
    let visibilidad = map(factorOscuro, 0, 1, est.alfaBase * 0.65, est.alfaBase);
    fill(red(colTrazo), green(colTrazo), blue(colTrazo), visibilidad);
    circle(est.x, est.y, est.tamano);
  }

  pop();
}

function actualizarColoresDinamicos() {
  colFondo   = lerpColor(color(PALETA_CLARA.fondo),   color(PALETA_OSCURA.fondo),   factorOscuro);
  colTrazo   = lerpColor(color(PALETA_CLARA.trazo),   color(PALETA_OSCURA.trazo),   factorOscuro);
  colAcento  = lerpColor(color(PALETA_CLARA.acento),  color(PALETA_OSCURA.acento),  factorOscuro);
  colDetalle = lerpColor(color(PALETA_CLARA.detalle), color(PALETA_OSCURA.detalle), factorOscuro);
}

// --------------------------------------------------------
// CLASE AGENTE AUTÓNOMO (NAVE ESPACIAL)
// --------------------------------------------------------
class Agente {
  constructor(x, y, esGuia = false) {
    this.posicion = createVector(x, y);
    this.velocidad = p5.Vector.random2D().mult(random(2, 4));
    this.aceleracion = createVector(0, 0);
    
    this.esGuia = esGuia;
    this.maxVelocidad = esGuia ? 8.5 : 6.5;
    this.maxFuerza = esGuia ? 0.18 : 0.12; 
    
    this.radioPercepcion = esGuia ? 90 : 50;
    this.distanciaSeparacion = 28;
    this.vecinosCercanos = 0;
  }

  aplicarFuerza(fuerza) {
    this.aceleracion.add(fuerza);
  }

  aplicarSteeringOrbital(target) {
    let deseada = p5.Vector.sub(target, this.posicion);
    let d = deseada.mag();
    deseada.normalize();
    let speed = map(d, 0, 500, 1.5, this.maxVelocidad);
    deseada.mult(speed);

    let steering = p5.Vector.sub(deseada, this.velocidad);
    steering.limit(this.maxFuerza);
    this.aplicarFuerza(steering);
  }

  aplicarFlowFieldVortice(centro) {
    let radio = p5.Vector.sub(this.posicion, centro);
    let tangente = createVector(-radio.y, radio.x).normalize();
    tangente.mult(2.0);

    let fuerzaVortice = p5.Vector.sub(tangente, this.velocidad);
    fuerzaVortice.limit(this.maxFuerza * 0.7);
    this.aplicarFuerza(fuerzaVortice);
  }

  aplicarFlockingCompleto(vecinos) {
    let sumaVelocidades = createVector(0, 0);
    let fuerzaSeparacion = createVector(0, 0);
    let totalAlineacion = 0;
    let totalSeparacion = 0;

    for (let otro of vecinos) {
      let d = p5.Vector.dist(this.posicion, otro.posicion);

      if (otro !== this) {
        if (d < this.radioPercepcion) {
          sumaVelocidades.add(otro.velocidad);
          totalAlineacion++;
        }

        if (d < this.distanciaSeparacion) {
          let diff = p5.Vector.sub(this.posicion, otro.posicion);
          diff.normalize();
          diff.div(d);
          fuerzaSeparacion.add(diff);
          totalSeparacion++;
        }
      }
    }

    this.vecinosCercanos = totalAlineacion;

    if (totalAlineacion > 0) {
      sumaVelocidades.div(totalAlineacion);
      sumaVelocidades.setMag(this.maxVelocidad);
      let steerAlineacion = p5.Vector.sub(sumaVelocidades, this.velocidad);
      steerAlineacion.limit(this.maxFuerza);
      steerAlineacion.mult(paramFlocking);
      this.aplicarFuerza(steerAlineacion);
    }

    if (totalSeparacion > 0) {
      fuerzaSeparacion.div(totalSeparacion);
      fuerzaSeparacion.setMag(this.maxVelocidad);
      let steerSeparacion = p5.Vector.sub(fuerzaSeparacion, this.velocidad);
      steerSeparacion.limit(this.maxFuerza * 1.5);
      this.aplicarFuerza(steerSeparacion);
    }
  }

  aplicarInerciaTangencial() {
    this.velocidad.mult(1.01);
  }

  actualizar() {
    this.velocidad.add(this.aceleracion);
    this.velocidad.mult(paramFriccion);
    this.posicion.add(this.velocidad);
    this.aceleracion.mult(0);

    if (this.posicion.x < 0) this.posicion.x = width;
    if (this.posicion.x > width) this.posicion.x = 0;
    if (this.posicion.y < 0) this.posicion.y = height;
    if (this.posicion.y > height) this.posicion.y = 0;
  }

  depositarPhysarum(buffer) {
    buffer.push();
    buffer.stroke(colTrazo);
    buffer.strokeWeight(this.esGuia ? 1.4 : 0.5);
    buffer.noFill();
    
    let radioCurvatura = this.velocidad.mag() * (this.esGuia ? 7 : 4);
    buffer.arc(this.posicion.x, this.posicion.y, radioCurvatura, radioCurvatura, 0, HALF_PI);

    let probSpark = map(factorOscuro, 0, 1, 0.05, 0.30);
    if (random() < probSpark) {
      let colSpark = lerpColor(colAcento, colDetalle, random());
      buffer.stroke(colSpark);
      buffer.strokeWeight(random(1, 2.5));
      buffer.point(this.posicion.x + random(-10, 10), this.posicion.y + random(-10, 10));
    }

    buffer.pop();
  }

  dibujar() {
    push();
    let rapidez = this.velocidad.mag();

    let colorVelocidad = lerpColor(colTrazo, colAcento, map(rapidez, 0, this.maxVelocidad, 0, 1));
    let enEscuadra = this.vecinosCercanos >= 3;
    let colorVector = enEscuadra ? colDetalle : colorVelocidad;

    stroke(colorVector);
    strokeWeight(this.esGuia ? 1.5 : 1.0);
    let lVector = this.esGuia ? 4.5 : 2.8;
    let finVector = p5.Vector.add(this.posicion, p5.Vector.mult(this.velocidad, lVector));
    line(this.posicion.x, this.posicion.y, finVector.x, finVector.y);

    fill(colorVelocidad);
    noStroke();
    let tamanoNodo = this.esGuia ? 4.5 : 2.5;
    circle(this.posicion.x, this.posicion.y, tamanoNodo);

    if (this.esGuia) {
      stroke(colAcento);
      strokeWeight(0.8);
      noFill();
      circle(this.posicion.x, this.posicion.y, 14);
      line(this.posicion.x - 8, this.posicion.y, this.posicion.x + 8, this.posicion.y);
      line(this.posicion.x, this.posicion.y - 8, this.posicion.x, this.posicion.y + 8);
    }

    if (enEscuadra && !this.esGuia) {
      stroke(colDetalle);
      strokeWeight(0.5);
      noFill();
      circle(this.posicion.x, this.posicion.y, 8);
    }

    pop();
  }
}

// --------------------------------------------------------
// INTERFAZ & EVENTOS
// --------------------------------------------------------
function reanudarAudio() {
  if (!audioIniciado) {
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) {
      audioPlayer.play().catch(e => console.log("Esperando interacción del usuario..."));
      audioIniciado = true;
    }
  }
}

function dibujarAtractor() {
  push();
  stroke(colAcento);
  strokeWeight(1);
  noFill();
  circle(atractor.x, atractor.y, 22);
  circle(atractor.x, atractor.y, 4);
  line(atractor.x - 18, atractor.y, atractor.x + 18, atractor.y);
  line(atractor.x, atractor.y - 18, atractor.x, atractor.y + 18);
  pop();
}

function mouseDragged() {
  reanudarAudio();
  if (mouseX < width - 340 || mouseY > 320) {
    atractor.set(mouseX, mouseY);
  }
}

function mousePressed() {
  reanudarAudio();
  if (mouseX < width - 340 || mouseY > 320) {
    atractor.set(mouseX, mouseY);
  }
}

function keyPressed() {
  reanudarAudio();
  if (keyCode === 32) modoBurst = true; // Espacio
  
  if (key === 't' || key === 'T') {
    targetFactorOscuro = targetFactorOscuro === 0.0 ? 1.0 : 0.0;
    let sliderTema = document.getElementById('slider-tema');
    if (sliderTema) sliderTema.value = targetFactorOscuro;
  }

  if (key === 'r' || key === 'R') {
    physarumBuffer.background(colFondo);
    for (let a of agentes) {
      a.posicion.set(random(width), random(height));
    }
  }

  if (key === 'h' || key === 'H') {
    hudVisible = !hudVisible;
    document.getElementById('hud-panel').style.display = hudVisible ? 'block' : 'none';
  }
}

function keyReleased() {
  if (keyCode === 32) modoBurst = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  physarumBuffer.resizeCanvas(windowWidth, windowHeight);
  physarumBuffer.background(colFondo);
}

function configurarInterfazDOM() {
  const sliderFriccion = document.getElementById('slider-friccion');
  const sliderFlocking = document.getElementById('slider-flocking');
  const sliderPhysarum = document.getElementById('slider-physarum');
  const sliderTema     = document.getElementById('slider-tema');

  sliderFriccion.addEventListener('input', (e) => paramFriccion = parseFloat(e.target.value));
  sliderFlocking.addEventListener('input', (e) => paramFlocking = parseFloat(e.target.value));
  sliderPhysarum.addEventListener('input', (e) => paramPhysarumDecay = parseFloat(e.target.value));
  
  if (sliderTema) {
    sliderTema.addEventListener('input', (e) => targetFactorOscuro = parseFloat(e.target.value));
  }
}