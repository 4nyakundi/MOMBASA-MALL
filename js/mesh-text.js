// WebGL Mesh Text Hover Effect - Vanilla JS implementation
// Inspired by OriginKit MeshText component.

class MeshText {
  constructor(canvas, wrapper, options = {}) {
    this.canvas = canvas;
    this.wrapper = wrapper;
    
    // Default configs matching preset props
    this.text = options.text || "MOMBASA MALL";
    this.color = options.color || "#0f0f0f";
    this.fontFamily = options.fontFamily || "Plus Jakarta Sans";
    this.fontWeight = options.fontWeight || "800";
    this.fontStyle = options.fontStyle || "normal";
    this.fontSize = options.fontSize || 96;
    this.colorSplit = options.colorSplit !== undefined ? options.colorSplit : true;
    this.customColors = options.customColors || ["#d99c10", "#1a1a1a", "#ab9bd0"];
    this.force = (options.force !== undefined ? options.force : 12) / 10; // 1.2
    
    this.GRID_W = 96;
    this.GRID_H = 40;
    this.SPRING_K = 0.08;
    this.DAMPING = 0.9;
    this.DT = 0.1;
    this.CHROMA = 0.005;
    
    this.gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true
    });
    
    if (!this.gl) {
      console.warn("WebGL2 not available for MeshText");
      return;
    }
    
    this.initWebGL();
    this.setupEvents();
    this.resize();
    this.animate();
  }
  
  initWebGL() {
    const gl = this.gl;
    
    // Shader source definitions
    const VERT_SRC = `#version 300 es
    in vec2 aPos;
    in vec2 aUv;
    in vec2 aDisp;
    out vec2 vUv;
    out float vMag;
    void main() {
        gl_Position = vec4(aPos + aDisp, 0.0, 1.0);
        vUv = aUv;
        vMag = length(aDisp);
    }`;

    const FRAG_SRC = `#version 300 es
    precision highp float;
    in vec2 vUv;
    in float vMag;
    out vec4 outColor;
    uniform sampler2D uTex;
    uniform float uChroma;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    void main() {
        vec4 base = texture(uTex, vUv);
        if (uChroma > 0.0) {
            float o = uChroma * 0.00500 * clamp(vMag * 8.0, 0.0, 1.0);
            float aOff = texture(uTex, vUv + vec2(o, 0.0)).a;
            float bOff = texture(uTex, vUv - vec2(o, 0.0)).a;
            vec3 col = base.rgb * base.a;
            col += uColorA * max(0.0, aOff - base.a);
            col += uColorB * max(0.0, bOff - base.a);
            float aMax = max(base.a, max(aOff, bOff));
            outColor = vec4(col, aMax);
        } else {
            outColor = base;
        }
    }`;
    
    // Compilers
    const vs = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
    this.program = this.linkProgram(vs, fs);
    
    // Setup grid
    const vertCount = (this.GRID_W + 1) * (this.GRID_H + 1);
    this.positions = new Float32Array(vertCount * 2);
    this.uvs = new Float32Array(vertCount * 2);
    
    for (let y = 0; y <= this.GRID_H; y++) {
      for (let x = 0; x <= this.GRID_W; x++) {
        const i = y * (this.GRID_W + 1) + x;
        const u = x / this.GRID_W;
        const v = y / this.GRID_H;
        this.positions[i * 2] = u * 2 - 1;
        this.positions[i * 2 + 1] = 1 - v * 2;
        this.uvs[i * 2] = u;
        this.uvs[i * 2 + 1] = v;
      }
    }
    
    this.indexCount = this.GRID_W * this.GRID_H * 6;
    const indices = new Uint32Array(this.indexCount);
    let idx = 0;
    for (let y = 0; y < this.GRID_H; y++) {
      for (let x = 0; x < this.GRID_W; x++) {
        const a = y * (this.GRID_W + 1) + x;
        const b = a + 1;
        const c = a + (this.GRID_W + 1);
        const d = c + 1;
        indices[idx++] = a;
        indices[idx++] = c;
        indices[idx++] = b;
        indices[idx++] = b;
        indices[idx++] = c;
        indices[idx++] = d;
      }
    }
    
    this.disp = new Float32Array(vertCount * 2);
    this.vel = new Float32Array(vertCount * 2);
    
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);
    const aUv = gl.getAttribLocation(this.program, "aUv");
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    
    this.dispBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dispBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.disp, gl.DYNAMIC_DRAW);
    const aDisp = gl.getAttribLocation(this.program, "aDisp");
    gl.enableVertexAttribArray(aDisp);
    gl.vertexAttribPointer(aDisp, 2, gl.FLOAT, false, 0, 0);
    
    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    this.uTex = gl.getUniformLocation(this.program, "uTex");
    this.uChroma = gl.getUniformLocation(this.program, "uChroma");
    this.uColorA = gl.getUniformLocation(this.program, "uColorA");
    this.uColorB = gl.getUniformLocation(this.program, "uColorB");
    
    this.parsedColors = this.customColors.map(c => this.parseColor(c));
  }
  
  compileShader(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }
  
  linkProgram(vs, fs) {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }
  
  parseColor(hexStr) {
    let s = hexStr.trim();
    if (s.startsWith("#")) {
      let h = s.slice(1);
      if (h.length === 3) h = h.split("").map(c => c + c).join("");
      if (h.length >= 6) {
        return [
          parseInt(h.slice(0, 2), 16) / 255,
          parseInt(h.slice(2, 4), 16) / 255,
          parseInt(h.slice(4, 6), 16) / 255
        ];
      }
    }
    return [1, 1, 1];
  }
  
  async rebuildTexture() {
    const w = Math.max(2, this.canvas.width);
    const h = Math.max(2, this.canvas.height);
    const dpr = window.devicePixelRatio || 1;
    const realSize = this.fontSize * dpr;
    
    // Write text to 2D canvas
    const textCanvas = document.createElement("canvas");
    textCanvas.width = w;
    textCanvas.height = h;
    const ctx = textCanvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `${this.fontStyle} ${this.fontWeight} ${realSize}px "${this.fontFamily}", sans-serif`;
    ctx.fillText(this.text, 0, h / 2);
    
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  }
  
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.wrapper.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    
    // Scale font size slightly on smaller screens
    if (rect.width < 500) {
      this.fontSize = 44;
    } else if (rect.width < 800) {
      this.fontSize = 68;
    } else {
      this.fontSize = 88;
    }
    
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
      this.rebuildTexture();
    }
  }
  
  setupEvents() {
    this.cursor = {
      x: 99, y: 99, px: 99, py: 99, vx: 0, vy: 0, inside: false
    };
    
    const onMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const x = nx * 2 - 1;
      const y = 1 - ny * 2;
      
      if (!this.cursor.inside) {
        this.cursor.px = x;
        this.cursor.py = y;
        this.cursor.inside = true;
      }
      this.cursor.x = x;
      this.cursor.y = y;
    };
    
    const onLeave = () => {
      this.cursor.inside = false;
      this.cursor.x = 99;
      this.cursor.y = 99;
      this.cursor.vx = 0;
      this.cursor.vy = 0;
    };
    
    this.wrapper.addEventListener("pointermove", onMove);
    this.wrapper.addEventListener("pointerleave", onLeave);
    
    window.addEventListener("resize", () => this.resize());
  }
  
  animate() {
    const vertCount = (this.GRID_W + 1) * (this.GRID_H + 1);
    
    const tick = () => {
      this.cursor.vx = this.cursor.x - this.cursor.px;
      this.cursor.vy = this.cursor.y - this.cursor.py;
      const vmag = Math.hypot(this.cursor.vx, this.cursor.vy);
      if (vmag > 0.3) {
        this.cursor.vx = 0;
        this.cursor.vy = 0;
      }
      this.cursor.px = this.cursor.x;
      this.cursor.py = this.cursor.y;
      
      // Physics calculations
      for (let i = 0; i < vertCount; i++) {
        const i2 = i * 2;
        const px = this.positions[i2];
        const py = this.positions[i2 + 1];
        const dx = this.disp[i2];
        const dy = this.disp[i2 + 1];
        
        const cx = this.cursor.x - (px + dx);
        const cy = this.cursor.y - (py + dy);
        const cd = Math.hypot(cx, cy);
        const proximity = Math.max(0, 1 / (1 + cd / 0.05) - 0.1);
        
        let vx = this.vel[i2];
        let vy = this.vel[i2 + 1];
        
        vx += this.cursor.vx * this.force * proximity;
        vy += this.cursor.vy * this.force * proximity;
        
        vx -= dx * this.SPRING_K;
        vy -= dy * this.SPRING_K;
        
        vx *= this.DAMPING;
        vy *= this.DAMPING;
        
        this.vel[i2] = vx;
        this.vel[i2 + 1] = vy;
        
        let ndx = dx + vx * this.DT;
        let ndy = dy + vy * this.DT;
        if (ndx > 1) ndx = 1;
        else if (ndx < -1) ndx = -1;
        if (ndy > 1) ndy = 1;
        else if (ndy < -1) ndy = -1;
        this.disp[i2] = ndx;
        this.disp[i2 + 1] = ndy;
      }
      
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dispBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.disp);
      
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(this.uTex, 0);
      gl.uniform1f(this.uChroma, this.colorSplit ? 1.0 : 0.0);
      
      // Chroma colours rotation logic
      let cA = [0.25, 0.29, 1.0]; // Default blue-ish
      let cB = [1.0, 1.0, 1.0]; // Default white
      
      const cols = this.parsedColors;
      if (cols.length === 1) {
        cA = cols[0];
        cB = cols[0];
      } else if (cols.length > 1) {
        const cycleMs = 400;
        const idx = Math.floor(performance.now() / cycleMs) % cols.length;
        cA = cols[idx];
        cB = cols[(idx + 1) % cols.length];
      }
      
      gl.uniform3f(this.uColorA, cA[0], cA[1], cA[2]);
      gl.uniform3f(this.uColorB, cB[0], cB[1], cB[2]);
      
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      
      gl.bindVertexArray(this.vao);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
      
      requestAnimationFrame(tick);
    };
    
    requestAnimationFrame(tick);
  }
}

// Auto-initialize when content loaded
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("mesh-title-canvas");
  const wrapper = document.getElementById("mesh-title-wrapper");
  if (canvas && wrapper) {
    new MeshText(canvas, wrapper, {
      text: "MOMBASA MALL",
      color: "#0f0f0f",
      fontFamily: "Plus Jakarta Sans",
      fontWeight: "800",
      customColors: ["#d99c10", "#ab9bd0", "#0f0f0f"],
      force: 12
    });
  }
});
