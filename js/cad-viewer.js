/**
 * CAM LABS — Interactive 3D CAD Inspection Viewer
 * High-precision canvas-based 3D mesh rendering with lighting, wireframe, slicing & orbit controls
 */

class CadViewer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Viewer Settings & Modes
    this.renderMode = 'solid'; // 'solid', 'wireframe', 'slicing', 'stress'
    this.rotation = { x: 0.45, y: -0.65, z: 0 };
    this.zoom = 1.0;
    this.isDragging = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.sliceProgress = 1.0; // For slicing layer animation
    this.animTime = 0;

    // Active Part Geometry Data
    this.currentPart = "manifold";
    this.mesh = this.generateMechanicalMesh(this.currentPart);

    this.initEvents();
    this.resize();
    this.startLoop();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.width = rect.width;
    this.height = rect.height;
    this.ctx.scale(dpr, dpr);
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMousePos.x;
      const dy = e.clientY - this.prevMousePos.y;

      this.rotation.y += dx * 0.008;
      this.rotation.x += dy * 0.008;

      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    // Touch support for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.prevMousePos.x;
        const dy = e.touches[0].clientY - this.prevMousePos.y;
        this.rotation.y += dx * 0.01;
        this.rotation.x += dy * 0.01;
        this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.max(0.4, Math.min(2.5, this.zoom * zoomFactor));
    }, { passive: false });
  }

  setMode(mode) {
    this.renderMode = mode;
  }

  loadPart(partType) {
    this.currentPart = partType;
    this.mesh = this.generateMechanicalMesh(partType);
  }

  generateMechanicalMesh(type) {
    const vertices = [];
    const faces = [];

    if (type === "bracket") {
      // Structural L-Bracket with weight-reduction lightening pockets and mounting bores
      const s = 70;
      const t = 18;
      const d = 50;

      // Base block
      const v = [
        [-s, -s, -d], [s, -s, -d], [s, -s+t, -d], [-s+t, -s+t, -d], [-s+t, s, -d], [-s, s, -d],
        [-s, -s, d], [s, -s, d], [s, -s+t, d], [-s+t, -s+t, d], [-s+t, s, d], [-s, s, d]
      ];
      v.forEach(pt => vertices.push({ x: pt[0], y: pt[1], z: pt[2] }));

      // Add center ribs
      const ribCount = 8;
      for (let i = 0; i < ribCount; i++) {
        const angle = (i / ribCount) * Math.PI * 2;
        const r = 20;
        vertices.push({
          x: Math.cos(angle) * r - 15,
          y: Math.sin(angle) * r - 15,
          z: 0
        });
      }

      // Generate quad faces
      const quadIndices = [
        [0, 1, 2, 3], [3, 4, 5, 0], // front
        [6, 7, 8, 9], [9, 10, 11, 6], // back
        [0, 1, 7, 6], [1, 2, 8, 7], [2, 3, 9, 8], [3, 4, 10, 9], [4, 5, 11, 10], [5, 0, 6, 11] // sides
      ];

      quadIndices.forEach(q => {
        faces.push([q[0], q[1], q[2]]);
        faces.push([q[0], q[2], q[3]]);
      });

    } else if (type === "hinge") {
      // Precision Robotic Exoskeleton Joint
      const segments = 16;
      const rOuter = 55;
      const rInner = 28;
      const height = 45;

      for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x1 = Math.cos(theta) * rOuter;
        const y1 = Math.sin(theta) * rOuter;
        const x2 = Math.cos(theta) * rInner;
        const y2 = Math.sin(theta) * rInner;

        vertices.push({ x: x1, y: y1, z: -height / 2 });
        vertices.push({ x: x1, y: y1, z: height / 2 });
        vertices.push({ x: x2, y: y2, z: -height / 2 });
        vertices.push({ x: x2, y: y2, z: height / 2 });
      }

      for (let i = 0; i < segments; i++) {
        const nxt = (i + 1) % segments;
        const i0 = i * 4;
        const i1 = nxt * 4;
        faces.push([i0, i1, i1 + 1]);
        faces.push([i0, i1 + 1, i0 + 1]);
        faces.push([i0 + 2, i1 + 2, i1 + 3]);
        faces.push([i0 + 2, i1 + 3, i0 + 3]);
      }

    } else {
      // Default: High-Precision Industrial Turbine Manifold
      const rings = 12;
      const radialSegs = 20;
      const mainRadius = 60;
      const tubeRadius = 22;

      for (let r = 0; r < rings; r++) {
        const u = (r / rings) * Math.PI * 2;
        for (let s = 0; s < radialSegs; s++) {
          const v = (s / radialSegs) * Math.PI * 2;
          const x = (mainRadius + tubeRadius * Math.cos(v)) * Math.cos(u);
          const y = (mainRadius + tubeRadius * Math.cos(v)) * Math.sin(u);
          const z = tubeRadius * Math.sin(v) + Math.sin(u * 4) * 8; // Fluted cooling fins
          vertices.push({ x, y, z });
        }
      }

      for (let r = 0; r < rings; r++) {
        const nextR = (r + 1) % rings;
        for (let s = 0; s < radialSegs; s++) {
          const nextS = (s + 1) % radialSegs;
          const i1 = r * radialSegs + s;
          const i2 = nextR * radialSegs + s;
          const i3 = nextR * radialSegs + nextS;
          const i4 = r * radialSegs + nextS;

          faces.push([i1, i2, i3]);
          faces.push([i1, i3, i4]);
        }
      }
    }

    return { vertices, faces };
  }

  startLoop() {
    const loop = () => {
      this.animTime += 0.016;

      // Auto subtle rotation if not actively dragging
      if (!this.isDragging) {
        this.rotation.y += 0.003;
      }

      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render() {
    if (!this.ctx || !this.width) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const scale = Math.min(this.width, this.height) * 0.42 * this.zoom;

    // Light source direction vector (normalized)
    const light = { x: 0.577, y: -0.577, z: 0.577 };

    // Projection & Matrix transforms
    const cosX = Math.cos(this.rotation.x);
    const sinX = Math.sin(this.rotation.x);
    const cosY = Math.cos(this.rotation.y);
    const sinY = Math.sin(this.rotation.y);

    const projectedVertices = this.mesh.vertices.map(v => {
      // Rotate Y
      const x1 = v.x * cosY + v.z * sinY;
      const y1 = v.y;
      const z1 = -v.x * sinY + v.z * cosY;

      // Rotate X
      const x2 = x1;
      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      // Perspective projection
      const fov = 400;
      const dist = 320;
      const pz = z2 + dist;
      const projScale = fov / Math.max(1, pz);

      return {
        x: cx + x2 * (scale / 100) * (projScale / 1.5),
        y: cy + y2 * (scale / 100) * (projScale / 1.5),
        z: z2,
        origY: v.y
      };
    });

    // Sort faces by depth (Painter's algorithm)
    const sortedFaces = this.mesh.faces.map(face => {
      const p0 = projectedVertices[face[0]];
      const p1 = projectedVertices[face[1]];
      const p2 = projectedVertices[face[2]];
      const avgZ = (p0.z + p1.z + p2.z) / 3;
      return { face, avgZ, p0, p1, p2 };
    }).sort((a, b) => a.avgZ - b.avgZ);

    // Dynamic Slicing Layer Height
    let maxSliceHeight = 100;
    if (this.renderMode === 'slicing') {
      this.sliceProgress = (Math.sin(this.animTime * 1.5) + 1) / 2; // 0 to 1
      maxSliceHeight = (this.sliceProgress * 140) - 70;
    }

    // Render Faces
    sortedFaces.forEach(({ face, p0, p1, p2 }) => {
      // Normal vector calculation for lighting
      const ax = p1.x - p0.x;
      const ay = p1.y - p0.y;
      const bx = p2.x - p0.x;
      const by = p2.y - p0.y;
      const crossZ = ax * by - ay * bx;

      // Backface culling in solid mode
      if (crossZ < 0 && this.renderMode === 'solid') return;

      const avgOrigY = (this.mesh.vertices[face[0]].y + this.mesh.vertices[face[1]].y + this.mesh.vertices[face[2]].y) / 3;
      if (this.renderMode === 'slicing' && avgOrigY > maxSliceHeight) {
        return; // Sliced away
      }

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();

      if (this.renderMode === 'wireframe') {
        ctx.strokeStyle = '#0066FF';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      } else if (this.renderMode === 'stress') {
        // Stress gradient mode (Cyan to Red)
        const stress = (Math.sin(avgOrigY * 0.1) + 1) / 2;
        ctx.fillStyle = `rgba(${Math.floor(stress * 240)}, ${Math.floor((1 - stress) * 160 + 40)}, ${Math.floor(255 * (1 - stress))}, 0.85)`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else if (this.renderMode === 'slicing') {
        // Neon laser sintering layer
        if (Math.abs(avgOrigY - maxSliceHeight) < 8) {
          ctx.fillStyle = 'rgba(0, 102, 255, 0.9)';
          ctx.strokeStyle = '#60A5FA';
          ctx.lineWidth = 1.5;
        } else {
          ctx.fillStyle = 'rgba(31, 41, 55, 0.7)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 0.5;
        }
        ctx.fill();
        ctx.stroke();
      } else {
        // Default: Solid Precision Shaded
        const intensity = Math.max(0.15, Math.min(1.0, 0.4 + (crossZ / 5000)));
        const r = Math.floor(31 * intensity + 10);
        const g = Math.floor(41 * intensity + 20);
        const b = Math.floor(65 * intensity + 45);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 102, 255, 0.2)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    });

    // Draw Coordinate Triad Grid
    this.drawHudOverlay(ctx, cx, cy);
  }

  drawHudOverlay(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 102, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Bounding Box ticks
    const bbSize = 130 * this.zoom;
    ctx.strokeRect(cx - bbSize / 2, cy - bbSize / 2, bbSize, bbSize);
    ctx.setLineDash([]);

    // Dimensional Callout
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(229, 231, 235, 0.75)";
    ctx.fillText("X: 120.00 mm", cx - bbSize / 2, cy + bbSize / 2 + 14);
    ctx.fillText("Y: 85.00 mm", cx + bbSize / 2 - 70, cy + bbSize / 2 + 14);
    ctx.fillText("Z: 45.00 mm", cx + bbSize / 2 + 6, cy);

    ctx.restore();
  }
}

window.CadViewer = CadViewer;
