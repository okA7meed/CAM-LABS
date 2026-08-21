import { useEffect, useRef, useState } from 'react';

export type RenderMode = 'solid' | 'wireframe' | 'slicing' | 'stress';
export type PartType = 'manifold' | 'bracket' | 'hinge';

export const useCadViewer = (canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [activePart, setActivePart] = useState<PartType>('manifold');

  const animFrameId = useRef<number>(0);
  const rotation = useRef({ x: 0.45, y: -0.65, z: 0 });
  const zoom = useRef(1.0);
  const isDragging = useRef(false);
  const prevMousePos = useRef({ x: 0, y: 0 });
  const animTime = useRef(0);

  const generateMesh = (type: PartType) => {
    const vertices: { x: number; y: number; z: number }[] = [];
    const faces: number[][] = [];

    if (type === 'bracket') {
      const s = 70;
      const t = 18;
      const d = 50;

      const v = [
        [-s, -s, -d], [s, -s, -d], [s, -s + t, -d], [-s + t, -s + t, -d], [-s + t, s, -d], [-s, s, -d],
        [-s, -s, d], [s, -s, d], [s, -s + t, d], [-s + t, -s + t, d], [-s + t, s, d], [-s, s, d],
      ];
      v.forEach((pt) => vertices.push({ x: pt[0], y: pt[1], z: pt[2] }));

      const quadIndices = [
        [0, 1, 2, 3], [3, 4, 5, 0],
        [6, 7, 8, 9], [9, 10, 11, 6],
        [0, 1, 7, 6], [1, 2, 8, 7], [2, 3, 9, 8], [3, 4, 10, 9], [4, 5, 11, 10], [5, 0, 6, 11],
      ];

      quadIndices.forEach((q) => {
        faces.push([q[0], q[1], q[2]]);
        faces.push([q[0], q[2], q[3]]);
      });
    } else if (type === 'hinge') {
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
      // Turbine Manifold
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
          const z = tubeRadius * Math.sin(v) + Math.sin(u * 4) * 8;
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
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mesh = generateMesh(activePart);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMousePos.current.x;
      const dy = e.clientY - prevMousePos.current.y;
      rotation.current.y += dx * 0.008;
      rotation.current.x += dy * 0.008;
      prevMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      zoom.current = Math.max(0.4, Math.min(2.5, zoom.current * factor));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Render loop
    const render = () => {
      animTime.current += 0.016;
      if (!isDragging.current) {
        rotation.current.y += 0.003;
      }

      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = rect?.width || 400;
      const h = rect?.height || 380;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.42 * zoom.current;

      const cosX = Math.cos(rotation.current.x);
      const sinX = Math.sin(rotation.current.x);
      const cosY = Math.cos(rotation.current.y);
      const sinY = Math.sin(rotation.current.y);

      const projected = mesh.vertices.map((v) => {
        const x1 = v.x * cosY + v.z * sinY;
        const y1 = v.y;
        const z1 = -v.x * sinY + v.z * cosY;

        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        const pz = z2 + 320;
        const projScale = 400 / Math.max(1, pz);

        return {
          x: cx + x2 * (scale / 100) * (projScale / 1.5),
          y: cy + y2 * (scale / 100) * (projScale / 1.5),
          z: z2,
          origY: v.y,
        };
      });

      const sortedFaces = mesh.faces
        .map((face) => {
          const p0 = projected[face[0]];
          const p1 = projected[face[1]];
          const p2 = projected[face[2]];
          const avgZ = (p0.z + p1.z + p2.z) / 3;
          return { face, avgZ, p0, p1, p2 };
        })
        .sort((a, b) => a.avgZ - b.avgZ);

      let maxSliceHeight = 100;
      if (renderMode === 'slicing') {
        const sliceProg = (Math.sin(animTime.current * 1.5) + 1) / 2;
        maxSliceHeight = sliceProg * 140 - 70;
      }

      sortedFaces.forEach(({ face, p0, p1, p2 }) => {
        const ax = p1.x - p0.x;
        const ay = p1.y - p0.y;
        const bx = p2.x - p0.x;
        const by = p2.y - p0.y;
        const crossZ = ax * by - ay * bx;

        if (crossZ < 0 && renderMode === 'solid') return;

        const avgOrigY = (mesh.vertices[face[0]].y + mesh.vertices[face[1]].y + mesh.vertices[face[2]].y) / 3;
        if (renderMode === 'slicing' && avgOrigY > maxSliceHeight) return;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();

        if (renderMode === 'wireframe') {
          ctx.strokeStyle = '#0066FF';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        } else if (renderMode === 'stress') {
          const stress = (Math.sin(avgOrigY * 0.1) + 1) / 2;
          ctx.fillStyle = `rgba(${Math.floor(stress * 240)}, ${Math.floor((1 - stress) * 160 + 40)}, ${Math.floor(255 * (1 - stress))}, 0.85)`;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        } else if (renderMode === 'slicing') {
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
          const intensity = Math.max(0.15, Math.min(1.0, 0.4 + crossZ / 5000));
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

      // Overlay HUD callouts
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 102, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      const bbSize = 130 * zoom.current;
      ctx.strokeRect(cx - bbSize / 2, cy - bbSize / 2, bbSize, bbSize);
      ctx.setLineDash([]);
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = 'rgba(229, 231, 235, 0.75)';
      ctx.fillText('X: 120.00 mm', cx - bbSize / 2, cy + bbSize / 2 + 14);
      ctx.fillText('Y: 85.00 mm', cx + bbSize / 2 - 70, cy + bbSize / 2 + 14);
      ctx.fillText('Z: 45.00 mm', cx + bbSize / 2 + 6, cy);
      ctx.restore();

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(animFrameId.current);
    };
  }, [renderMode, activePart]);

  return {
    renderMode,
    setRenderMode,
    activePart,
    setActivePart,
  };
};
