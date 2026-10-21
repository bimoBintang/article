"use client";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * API yang diberikan viewer ke parent lewat `onReady`.
 */
export type Viewer3DApi = {
  /**
   * Ambil snapshot model yang sedang tampil sebagai data URL PNG
   * dengan background putih. Mengembalikan null bila scene belum siap.
   */
  capture: () => string | null;
};

interface Viewer3DProps {
  glbUrl?: string;
  posterUrl?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
  /** Dipanggil sekali viewer siap; memberikan API untuk snapshot. */
  onReady?: (api: Viewer3DApi) => void;
  className?: string;
}

export function Viewer3D({
  glbUrl,
  posterUrl,
  onLoad,
  onError,
  onReady,
  className = "w-full h-[500px]",
}: Viewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Callback disimpan di ref supaya perubahan parent tidak memicu
  // pembuatan ulang scene Three.js (yang berat & berkedip).
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
  });

  // Referensi internals scene untuk snapshot
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  /** Snapshot canvas WebGL → PNG dengan background putih. */
  const capture = useCallback((): string | null => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return null;

    try {
      // Render ulang agar isi canvas pasti terbaru sebelum dibaca
      renderer.render(scene, camera);

      const src = renderer.domElement;
      const out = document.createElement("canvas");
      out.width = src.width;
      out.height = src.height;
      const ctx = out.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0);
      return out.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // Check WebGL support
    try {
      const canvas = document.createElement("canvas");
      setWebglSupported(!!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      ));
    } catch {
      setWebglSupported(false);
    }

    if (!webglSupported) {
      setHasError(true);
      setIsLoading(false);
      onErrorRef.current?.("WebGL tidak didukung di browser Anda.");
      return;
    }

    if (!glbUrl) {
      setHasError(true);
      setIsLoading(false);
      onErrorRef.current?.("Model 3D tidak tersedia.");
      return;
    }

    // Setup Three.js scene
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.5, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 8;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Load GLB
    const loaderManager = new THREE.LoadingManager(
      () => {
        setIsLoading(false);
        onLoadRef.current?.();
      },
      (url: string, loaded: number, total: number) => {
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
        const bar = container.querySelector(".progress-bar");
        if (bar && "style" in bar) {
          (bar as HTMLElement).style.width = `${percent}%`;
        }
      },
      (error: unknown) => {
        console.error("Loader error:", error);
        setHasError(true);
        setIsLoading(false);
        onErrorRef.current?.("Gagal memuat model 3D.");
      }
    );

    const gltfLoader = new GLTFLoader(loaderManager);
    let model: THREE.Group | null = null;

    gltfLoader.load(
      glbUrl,
      (gltf: any) => {
        const loadedModel = gltf.scene;
        model = loadedModel;
        loadedModel.traverse((child: any) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        loadedModel.scale.set(scale, scale, scale);
        loadedModel.position.x = -center.x * scale;
        loadedModel.position.y = -center.y * scale + 0.5;
        loadedModel.position.z = -center.z * scale;

        scene.add(loadedModel);
        setIsLoading(false);
        onLoadRef.current?.();
        // Beri tahu parent bahwa viewer siap (untuk snapshot)
        onReadyRef.current?.({ capture });
      },
      undefined,
      (error: unknown) => {
        console.error("GLTF load error:", error);
        setHasError(true);
        setIsLoading(false);
        onErrorRef.current?.("Gagal memuat model 3D.");
      }
    );

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(() => {
        controls.update();
        renderer.render(scene, camera);
        animate();
      });
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (model) {
        scene.remove(model);
        model.traverse((child: any) => {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m: THREE.Material) => m.dispose());
            } else {
              (mesh.material as THREE.Material).dispose();
            }
          }
        });
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;

      // Hanya hapus canvas yang dibuat Three.js. Jangan memakai
      // container.innerHTML = "" karena React ikut memiliki child node
      // di dalam container dan akan gagal saat unmount
      // ("Failed to execute 'removeChild' on 'Node'").
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [glbUrl, posterUrl, webglSupported, capture]);

  const resetView = useCallback(() => {
    // Reset handled by component remount
  }, []);

  if (hasError) {
    return (
      <div ref={containerRef} className={className} style={{ background: "#f3f4f6" }}>
        <div className="flex h-full flex-col items-center justify-center text-zinc-500">
          <p className="mb-2 text-sm">Model 3D tidak tersedia</p>
          <p className="text-xs">Tampilkan galeri foto sebagai pengganti</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${className} relative overflow-hidden rounded-xl bg-zinc-100`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90">
          <div className="mb-4 w-64 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="progress-bar h-2 w-0 bg-primary transition-all duration-300"
              style={{ width: "0%" }}
            ></div>
          </div>
          <p className="text-xs text-zinc-500">Memuat model 3D...</p>
        </div>
      )}
      <div className="absolute right-4 top-4 z-10">
        <button
          onClick={resetView}
          className="rounded-full bg-white/90 p-2 text-zinc-600 shadow-sm backdrop-blur transition-colors hover:bg-white"
          aria-label="Reset tampilan"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
