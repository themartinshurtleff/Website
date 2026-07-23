import { useEffect, useRef } from 'react'
import * as THREE from 'three'

function createRandom(seed = 3847) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

export default function OrderflowTopology() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !window.WebGLRenderingContext) return undefined

    const random = createRandom()
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80)
    camera.position.set(0.8, 1.2, 16)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.dataset.orderflowTopology = 'true'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const topology = new THREE.Group()
    topology.rotation.set(-0.08, -0.28, -0.03)
    topology.position.set(0.5, -0.2, 0)
    scene.add(topology)

    const guideMaterial = new THREE.LineBasicMaterial({
      color: 0x8d9288,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    })
    const guidePoints = []
    for (let row = 0; row < 18; row += 1) {
      const y = -4.25 + row * 0.5
      guidePoints.push(new THREE.Vector3(-7.4, y, -1.9), new THREE.Vector3(7.4, y, -1.9))
    }
    for (let column = 0; column < 15; column += 1) {
      const x = -7.4 + column * 1.06
      guidePoints.push(new THREE.Vector3(x, -4.25, -1.9), new THREE.Vector3(x, 4.25, -1.9))
    }
    const guideGeometry = new THREE.BufferGeometry().setFromPoints(guidePoints)
    topology.add(new THREE.LineSegments(guideGeometry, guideMaterial))

    const liquidityBars = []
    const barGeometry = new THREE.BoxGeometry(1, 0.065, 0.18)
    const colors = {
      ask: new THREE.Color(0xc84f50),
      bid: new THREE.Color(0x2daaa0),
      focus: new THREE.Color(0xd8b553),
      neutral: new THREE.Color(0x767d78),
    }

    for (let row = 0; row < 17; row += 1) {
      const y = -4 + row * 0.5
      const segments = row % 3 === 0 ? 3 : 2
      for (let segment = 0; segment < segments; segment += 1) {
        const width = 1.2 + random() * 3.6
        const x = -5.8 + random() * 11.6
        const z = -1.25 + random() * 2.5
        const isFocus = random() > 0.86
        const color = isFocus ? colors.focus : y > 0.2 ? colors.ask : y < -0.2 ? colors.bid : colors.neutral
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: isFocus ? 0.82 : 0.22 + random() * 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const bar = new THREE.Mesh(barGeometry, material)
        bar.position.set(x, y, z)
        bar.scale.x = width
        bar.userData = {
          baseX: x,
          phase: random() * Math.PI * 2,
          drift: 0.04 + random() * 0.1,
        }
        liquidityBars.push(bar)
        topology.add(bar)
      }
    }

    const pricePoints = []
    let price = -0.9
    for (let index = 0; index < 52; index += 1) {
      price += (random() - 0.47) * 0.48
      price = Math.max(-2.7, Math.min(2.8, price))
      pricePoints.push(new THREE.Vector3(-7.2 + index * 0.282, price, 1.45))
    }
    const priceGeometry = new THREE.BufferGeometry().setFromPoints(pricePoints)
    const priceMaterial = new THREE.LineBasicMaterial({
      color: 0xf0c958,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
    })
    topology.add(new THREE.Line(priceGeometry, priceMaterial))

    const tradeGeometry = new THREE.BoxGeometry(0.11, 0.11, 0.11)
    for (let index = 3; index < pricePoints.length; index += 4) {
      const up = pricePoints[index].y >= pricePoints[index - 1].y
      const material = new THREE.MeshBasicMaterial({
        color: up ? 0x53d7c9 : 0xea6268,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      })
      const trade = new THREE.Mesh(tradeGeometry, material)
      trade.position.copy(pricePoints[index])
      trade.scale.setScalar(0.72 + random() * 1.55)
      topology.add(trade)
    }

    const cursorGeometry = new THREE.BoxGeometry(0.025, 8.6, 3.7)
    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: 0x60e0d3,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const cursor = new THREE.Mesh(cursorGeometry, cursorMaterial)
    cursor.position.set(-7.2, 0, 0)
    topology.add(cursor)

    const pointer = { x: 0, y: 0 }
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let visible = true
    let frame = 0
    let renderedFrames = 0
    let start = performance.now()
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !frame) {
        start = performance.now()
        frame = requestAnimationFrame(render)
      }
    })
    intersectionObserver.observe(mount)

    function render(now) {
      frame = 0
      const elapsed = (now - start) / 1000
      topology.rotation.y += ((-0.28 + pointer.x * 0.045) - topology.rotation.y) * 0.035
      topology.rotation.x += ((-0.08 - pointer.y * 0.025) - topology.rotation.x) * 0.035

      if (!reducedMotion) {
        cursor.position.x = -7.2 + ((elapsed * 1.08) % 14.4)
        liquidityBars.forEach((bar) => {
          bar.position.x = bar.userData.baseX + Math.sin(elapsed * bar.userData.drift + bar.userData.phase) * 0.08
          bar.material.opacity += ((0.2 + (Math.sin(elapsed * 0.55 + bar.userData.phase) + 1) * 0.11) - bar.material.opacity) * 0.025
        })
      }

      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      renderedFrames += 1

      if (import.meta.env.DEV && renderedFrames % 20 === 0) {
        const gl = renderer.getContext()
        const sampleWidth = Math.min(96, gl.drawingBufferWidth)
        const sampleHeight = Math.min(64, gl.drawingBufferHeight)
        const pixels = new Uint8Array(sampleWidth * sampleHeight * 4)
        const sampleX = Math.max(0, Math.floor((gl.drawingBufferWidth - sampleWidth) / 2))
        const sampleY = Math.max(0, Math.floor((gl.drawingBufferHeight - sampleHeight) / 2))
        gl.readPixels(sampleX, sampleY, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

        let litPixels = 0
        let signature = 2166136261
        for (let index = 0; index < pixels.length; index += 4) {
          const value = pixels[index] + pixels[index + 1] + pixels[index + 2]
          if (value > 15) litPixels += 1
          signature ^= value
          signature = Math.imul(signature, 16777619)
        }
        renderer.domElement.dataset.litPixels = String(litPixels)
        renderer.domElement.dataset.pixelSignature = String(signature >>> 0)
      }

      if (visible && !reducedMotion) frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      intersectionObserver.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      topology.traverse((object) => {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
        else object.material?.dispose()
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={mountRef} className="tn-orderflow-topology" aria-hidden="true" />
}
