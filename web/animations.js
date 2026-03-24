// Initialize Lenis for Smooth Scrolling
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // https://www.desmos.com/calculator/brs54l4xou
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
})

function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

// Connect GSAP ScrollTrigger to Lenis
gsap.registerPlugin(ScrollTrigger);

// Removed custom cursor per user request

// Landing Page Animations (if elements exist)
const heroTexts = document.querySelectorAll('.hero-text');
if (heroTexts.length > 0) {
    gsap.from(heroTexts, {
        y: "110%",
        duration: 1.2,
        ease: "power4.out",
        stagger: 0.15,
        delay: 0.2
    });

    gsap.from('.hero-sub', {
        opacity: 0,
        y: 20,
        duration: 1,
        ease: "power3.out",
        delay: 0.8
    });

    gsap.from('.floating-card', {
        y: 100,
        opacity: 0,
        duration: 1.5,
        ease: "power4.out",
        delay: 0.5
    });
}

// Scroll Animations for Features
const featureCards = document.querySelectorAll('.feature-card');
if (featureCards.length > 0) {
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#features",
            start: "top 75%",
            end: "bottom 25%",
            scrub: 1 // Link animation to scroll progress
        }
    });

    // Card slide up
    tl.from(featureCards, {
        y: 100,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out"
    }, 0);

    // SVG Drawing Animation
    const svgPaths = document.querySelectorAll('.svg-dynamic-path');
    if (svgPaths.length > 0) {
        svgPaths.forEach(path => {
            const length = path.getTotalLength();
            // Set up initial state (hidden)
            gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
            // Animate on scroll
            tl.to(path, { strokeDashoffset: 0, duration: 2, ease: "power1.inOut" }, 0);
        });
    }
}

// --- High-Fidelity Three.js Background ---
const canvas = document.getElementById('webgl-canvas');
if (canvas && typeof THREE !== 'undefined') {
    const scene = new THREE.Scene();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance

    // Geometry & Material (Particles)
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color('#00ff66'); // Primary Accent
    const color2 = new THREE.Color('#ffffff'); // White

    for (let i = 0; i < particleCount * 3; i += 3) {
        // Spread particles over a wide area
        positions[i] = (Math.random() - 0.5) * 100;     // x
        positions[i + 1] = (Math.random() - 0.5) * 100; // y
        positions[i + 2] = (Math.random() - 0.5) * 50;  // z

        // Interpolate colors
        const mixedColor = color1.clone().lerp(color2, Math.random());
        colors[i] = mixedColor.r;
        colors[i + 1] = mixedColor.g;
        colors[i + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse Interaction
    let targetX = 0;
    let targetY = 0;

    document.addEventListener('mousemove', (e) => {
        // Normalize coordinates to -1 to 1
        targetX = (e.clientX / window.innerWidth) * 2 - 1;
        targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // Animation Loop
    const clock = new THREE.Clock();

    const tick = () => {
        const elapsedTime = clock.getElapsedTime();

        // Gentle rotation over time
        particles.rotation.y = elapsedTime * 0.05;
        particles.rotation.x = elapsedTime * 0.02;

        // Smoothly move towards mouse target
        camera.position.x += (targetX * 5 - camera.position.x) * 0.05;
        camera.position.y += (targetY * 5 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    };

    tick();
}

// --- PHASE 5: Desktop OS Interactive Garage (3D Car) ---
const garageContainer = document.getElementById('car-canvas-container');
if (garageContainer && typeof THREE !== 'undefined') {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, garageContainer.clientWidth / garageContainer.clientHeight, 0.1, 100);
    camera.position.set(5, 3, 5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(garageContainer.clientWidth, garageContainer.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    garageContainer.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const accentLight = new THREE.PointLight(0x00e1ff, 2, 20);
    accentLight.position.set(-5, 2, -5);
    scene.add(accentLight);

    // Create a stylized "Concept Car" primitive
    const carGroup = new THREE.Group();

    // Materials - "NASCAR Wrap" vibe (High contrast, slightly metallic)
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.2,
        metalness: 0.8,
        wireframe: false
    });

    const detailMat = new THREE.MeshStandardMaterial({
        color: 0xff3366, // Neon pink racing accent
        roughness: 0.1,
        metalness: 0.9
    });

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(3, 0.6, 1.4);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.4;
    carGroup.add(chassis);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.4, 0.5, 1.2);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(-0.2, 0.95, 0);
    carGroup.add(cabin);

    // Racing Stripe
    const stripeGeo = new THREE.BoxGeometry(3.05, 0.65, 0.2);
    const stripe = new THREE.Mesh(stripeGeo, detailMat);
    stripe.position.y = 0.4;
    carGroup.add(stripe);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
    wheelGeo.rotateX(Math.PI / 2);

    const wheelPositions = [
        [-1, 0.3, 0.75], [1, 0.3, 0.75],
        [-1, 0.3, -0.75], [1, 0.3, -0.75]
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...pos);
        carGroup.add(wheel);

        // Rims
        const rimGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.22, 16);
        rimGeo.rotateX(Math.PI / 2);
        const rim = new THREE.Mesh(rimGeo, detailMat);
        rim.position.set(...pos);
        carGroup.add(rim);
    });

    scene.add(carGroup);

    // Animation Loop
    const tick = () => {
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    };
    tick();

    // Resize handler
    // We use ResizeObserver because it's inside a draggable window
    const resizeObserver = new ResizeObserver(() => {
        if (garageContainer.clientWidth === 0) return; // Hidden
        camera.aspect = garageContainer.clientWidth / garageContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(garageContainer.clientWidth, garageContainer.clientHeight);
    });
    resizeObserver.observe(garageContainer);
}

// --- PHASE 5: Hypeboard Marquee (GSAP) ---
const hypeboardWindow = document.getElementById('hypeboard-window');
if (hypeboardWindow && typeof gsap !== 'undefined') {
    // We simply clone the content to create a seamless loop
    const marquees = document.querySelectorAll('.marquee-content');
    marquees.forEach(m => {
        const clone = m.cloneNode(true);
        m.parentElement.appendChild(clone);
        gsap.to(m.parentElement.children, {
            xPercent: -100,
            repeat: -1,
            duration: 15,
            ease: "linear"
        });
    });

    const marqueesRev = document.querySelectorAll('.marquee-content-reverse');
    marqueesRev.forEach(m => {
        const clone = m.cloneNode(true);
        m.parentElement.appendChild(clone);
        gsap.fromTo(m.parentElement.children,
            { xPercent: -100 },
            {
                xPercent: 0,
                repeat: -1,
                duration: 20,
                ease: "linear"
            }
        );
    });
}

