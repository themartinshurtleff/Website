import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const COLUMN_COUNT = 9
const ROW_COUNT = 10
const HEATMAP_COLUMN_COUNT = 54
const HEATMAP_ROW_COUNT = 22
const BOARD_WIDTH = 11.6
const BOARD_HEIGHT = 7.2
const TEXTURE_WIDTH = 1536
const TEXTURE_HEIGHT = 960
const BASE_PRICE = 64860
const PRICE_STEP = 10

const LAYOUT = {
  left: 70,
  right: 116,
  top: 128,
  bottom: 176,
}

const PLOT_WIDTH = TEXTURE_WIDTH - LAYOUT.left - LAYOUT.right
const PLOT_HEIGHT = TEXTURE_HEIGHT - LAYOUT.top - LAYOUT.bottom
const CELL_WIDTH = PLOT_WIDTH / COLUMN_COUNT
const CELL_HEIGHT = PLOT_HEIGHT / ROW_COUNT
const UI_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const COLORS = {
  buy: '#1eaa76',
  buyBright: '#36e4a5',
  sell: '#a64cbd',
  sellBright: '#df63f0',
  gold: '#e2c330',
  text: '#f2f3ef',
  muted: '#7d827d',
}

function createRandom(seed = 92141) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function roundQuantity(value) {
  return Number(value.toFixed(3))
}

function recalculateCandle(candle) {
  let maxTotal = -1
  let pocRow = candle.low
  let buyTotal = 0
  let sellTotal = 0

  candle.levels.forEach((level, row) => {
    const total = level.buyBase + level.sellBase
    buyTotal += level.buyBase
    sellTotal += level.sellBase
    if (total > maxTotal) {
      maxTotal = total
      pocRow = row
    }
  })

  candle.buyTotal = buyTotal
  candle.sellTotal = sellTotal
  candle.volume = buyTotal + sellTotal
  candle.delta = buyTotal - sellTotal
  candle.pocRow = pocRow
}

function buildFootprintData() {
  const random = createRandom()
  const closes = [6, 4, 3, 4, 2, 4, 6, 5, 8]
  const candles = []

  for (let column = 0; column < COLUMN_COUNT; column += 1) {
    const open = column === 0 ? 2 : closes[column - 1]
    const close = closes[column]
    const low = clamp(Math.min(open, close) - 1 - (random() > 0.7 ? 1 : 0), 0, ROW_COUNT - 1)
    const high = clamp(Math.max(open, close) + 1 + (random() > 0.78 ? 1 : 0), 0, ROW_COUNT - 1)
    const levels = Array.from({ length: ROW_COUNT }, (_, row) => {
      if (row < low || row > high) return { sellBase: 0, buyBase: 0 }
      const distance = Math.abs(row - close)
      const profile = Math.max(0.3, 1 - distance * 0.14)
      const activity = (0.02 + Math.pow(random(), 1.72) * 76) * profile
      let sellBase = roundQuantity(activity * (0.28 + random() * 1.08))
      let buyBase = roundQuantity(activity * (0.28 + random() * 1.08))

      if ((column + row) % 7 === 2) buyBase = roundQuantity(buyBase * 3.2)
      if ((column * 2 + row) % 9 === 4) sellBase = roundQuantity(sellBase * 3.05)
      return { sellBase, buyBase }
    })

    const candle = {
      time: `09:${String(21 + column).padStart(2, '0')}`,
      open,
      high,
      low,
      close,
      oiDelta: roundQuantity((random() - 0.47) * 96),
      levels,
    }
    recalculateCandle(candle)
    candles.push(candle)
  }

  return candles
}

function heatmapWall(row, column) {
  if (row === 2 && column < 45) return 0.9
  if (row === 4 && column > 12) return 0.58
  if (row === 16 && column > 4 && column < 38) return 0.5
  if (row === 18 && column > 18) return 0.72
  if (row === 20 && column > 2 && column < 24) return 0.46
  return 0
}

function buildHeatmapData() {
  const random = createRandom(54019)
  const columns = []
  let previous = Array.from({ length: HEATMAP_ROW_COUNT }, () => random() * 0.16)

  for (let column = 0; column < HEATMAP_COLUMN_COUNT; column += 1) {
    const next = previous.map((value, row) => {
      const burst = random() > 0.93 ? 0.26 + random() * 0.48 : 0
      const ambient = value * (0.7 + random() * 0.18) + random() * 0.12 + burst
      return clamp(Math.max(ambient, heatmapWall(row, column) * (0.86 + random() * 0.14)), 0, 1)
    })
    columns.push(next)
    previous = next
  }

  return { columns }
}

function advanceHeatmap(heatmap, tick) {
  const random = createRandom(54019 + tick * 173)
  const previous = heatmap.columns.at(-1)
  const next = previous.map((value, row) => {
    const burst = random() > 0.94 ? 0.24 + random() * 0.42 : 0
    const persistentWall = row === 2 || row === 18 ? 0.58 + random() * 0.22 : 0
    return clamp(Math.max(value * (0.74 + random() * 0.16) + random() * 0.1 + burst, persistentWall), 0, 1)
  })
  heatmap.columns.shift()
  heatmap.columns.push(next)
}

function advanceFormingCandle(candle, tick) {
  const direction = [1, 1, -1, 0, 1, -1][tick % 6]
  const nextRow = clamp(candle.close + direction, 0, ROW_COUNT - 1)
  const level = candle.levels[nextRow]
  const quantity = 0.4 + ((tick * 11) % 29) * 0.37

  if (tick % 3 === 0 || tick % 3 === 1) level.buyBase = roundQuantity(level.buyBase + quantity)
  else level.sellBase = roundQuantity(level.sellBase + quantity)

  candle.close = nextRow
  candle.high = Math.max(candle.high, nextRow)
  candle.low = Math.min(candle.low, nextRow)
  candle.oiDelta = roundQuantity(candle.oiDelta + (tick % 2 === 0 ? quantity * 0.42 : -quantity * 0.28))
  recalculateCandle(candle)
}

function footprintAlpha(ratio, min = 0.08, max = 0.9) {
  const normalized = clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1)
  return min + (max - min) * Math.pow(normalized, 0.65)
}

function formatQuantity(value) {
  const absolute = Math.abs(value)
  if (absolute >= 1000) return `${(value / 1000).toFixed(1)}k`
  if (absolute >= 100) return value.toFixed(0)
  if (absolute >= 10) return value.toFixed(1)
  if (absolute >= 1) return value.toFixed(2)
  return value.toFixed(3)
}

function formatDelta(value) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatQuantity(value)}`
}

function formatOiDelta(value) {
  const prefix = value > 0 ? '+' : ''
  const absolute = Math.abs(value)
  const formatted = absolute < 10 ? absolute.toFixed(3) : absolute.toFixed(1)
  return `${prefix}${value < 0 ? '-' : ''}${formatted}`
}

function priceForRow(row) {
  return BASE_PRICE + row * PRICE_STEP
}

function getImbalance(candle, row) {
  const current = candle.levels[row]
  const lowerSell = row > 0 ? candle.levels[row - 1].sellBase : 0
  const upperBuy = row < ROW_COUNT - 1 ? candle.levels[row + 1].buyBase : 0
  return {
    buy: lowerSell > 0 && current.buyBase >= 4 && current.buyBase >= lowerSell * 3,
    sell: upperBuy > 0 && current.sellBase >= 4 && current.sellBase >= upperBuy * 3,
  }
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

function drawOrderbookHeatmap(context, candles, heatmap, livePulse) {
  const heatCellWidth = PLOT_WIDTH / HEATMAP_COLUMN_COUNT
  const heatCellHeight = PLOT_HEIGHT / HEATMAP_ROW_COUNT

  context.save()
  context.globalCompositeOperation = 'screen'
  heatmap.columns.forEach((columnLevels, column) => {
    const candlePosition = column / (HEATMAP_COLUMN_COUNT - 1) * (candles.length - 1)
    const leftCandle = Math.floor(candlePosition)
    const rightCandle = Math.min(candles.length - 1, leftCandle + 1)
    const fraction = candlePosition - leftCandle
    const marketRow = candles[leftCandle].close
      + (candles[rightCandle].close - candles[leftCandle].close) * fraction

    columnLevels.forEach((intensity, row) => {
      if (intensity < 0.14) return
      const priceRow = row / (HEATMAP_ROW_COUNT - 1) * (ROW_COUNT - 1)
      const normalized = clamp((intensity - 0.12) / 0.88, 0, 1)
      const edgePulse = column > HEATMAP_COLUMN_COUNT - 5 ? 0.88 + livePulse * 0.2 : 1
      const alpha = (0.02 + Math.pow(normalized, 1.38) * 0.32) * edgePulse
      const visualRow = HEATMAP_ROW_COUNT - 1 - row
      context.fillStyle = priceRow >= marketRow
        ? `rgba(147, 18, 91, ${alpha})`
        : `rgba(188, 55, 8, ${alpha})`
      context.fillRect(
        LAYOUT.left + column * heatCellWidth,
        LAYOUT.top + visualRow * heatCellHeight,
        heatCellWidth + 1.4,
        heatCellHeight + 1.4,
      )
    })
  })
  context.restore()
}

function drawImbalanceExtensions(context, candles) {
  context.save()
  context.lineWidth = 1.5
  context.setLineDash([7, 8])

  candles.forEach((candle, column) => {
    candle.levels.forEach((_, row) => {
      const imbalance = getImbalance(candle, row)
      if (!imbalance.buy && !imbalance.sell) return

      const fromX = LAYOUT.left + (column + 1) * CELL_WIDTH - 5
      let toX = LAYOUT.left + PLOT_WIDTH
      for (let later = column + 1; later < candles.length; later += 1) {
        if (candles[later].low <= row && candles[later].high >= row) {
          toX = LAYOUT.left + later * CELL_WIDTH
          break
        }
      }
      if (toX <= fromX) return

      const visualRow = ROW_COUNT - 1 - row
      const y = LAYOUT.top + visualRow * CELL_HEIGHT + CELL_HEIGHT / 2
      const sides = [
        imbalance.sell && { color: 'rgba(223, 99, 240, 0.72)', offset: -1 },
        imbalance.buy && { color: 'rgba(54, 228, 165, 0.72)', offset: 1 },
      ].filter(Boolean)

      sides.forEach(({ color, offset }) => {
        context.strokeStyle = color
        context.beginPath()
        context.moveTo(fromX, y + offset)
        context.lineTo(toX, y + offset)
        context.stroke()
      })
    })
  })

  context.restore()
}

function drawFootprintTexture(context, candles, heatmap, livePulse) {
  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)

  roundedRect(context, 10, 10, TEXTURE_WIDTH - 20, TEXTURE_HEIGHT - 20, 22)
  context.fillStyle = 'rgba(1, 2, 2, 0.88)'
  context.fill()
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  context.lineWidth = 2
  context.stroke()

  context.fillStyle = COLORS.text
  context.font = `600 27px ${UI_FONT}`
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText('BTCUSDT', LAYOUT.left, 49)

  context.fillStyle = COLORS.muted
  context.font = `500 16px ${UI_FONT}`
  context.fillText('AGGREGATED FOOTPRINT / 1m / BASE QTY', LAYOUT.left, 80)

  context.fillStyle = 'rgba(0, 0, 0, 0.5)'
  context.fillRect(LAYOUT.left, LAYOUT.top, PLOT_WIDTH, PLOT_HEIGHT)
  drawOrderbookHeatmap(context, candles, heatmap, livePulse)

  drawImbalanceExtensions(context, candles)

  candles.forEach((candle, column) => {
    const x = LAYOUT.left + column * CELL_WIDTH
    const stripWidth = 10
    const clusterLeft = x + stripWidth + 3
    const clusterWidth = CELL_WIDTH - stripWidth - 7
    const midpoint = clusterLeft + clusterWidth / 2
    const maxSide = Math.max(1, ...candle.levels.flatMap((level) => [level.sellBase, level.buyBase]))

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `600 13px ${UI_FONT}`
    context.fillStyle = candle.delta >= 0 ? COLORS.buyBright : COLORS.sellBright
    context.fillText(formatDelta(candle.delta), x + CELL_WIDTH / 2, 104)
    context.fillStyle = candle.oiDelta >= 0 ? '#35dca0' : '#d85be8'
    context.fillText(formatOiDelta(candle.oiDelta), x + CELL_WIDTH / 2, 120)

    for (let row = 0; row < ROW_COUNT; row += 1) {
      const level = candle.levels[row]
      if (level.sellBase === 0 && level.buyBase === 0) continue
      const visualRow = ROW_COUNT - 1 - row
      const y = LAYOUT.top + visualRow * CELL_HEIGHT
      const isPoc = row === candle.pocRow
      const sellAlpha = footprintAlpha(level.sellBase / maxSide, isPoc ? 0.3 : 0.1, isPoc ? 0.98 : 0.86)
      const buyAlpha = footprintAlpha(level.buyBase / maxSide, isPoc ? 0.3 : 0.1, isPoc ? 0.98 : 0.86)

      context.fillStyle = `rgba(162, 70, 184, ${sellAlpha})`
      context.fillRect(clusterLeft, y + 2, clusterWidth / 2 - 1, CELL_HEIGHT - 4)
      context.fillStyle = `rgba(24, 151, 105, ${buyAlpha})`
      context.fillRect(midpoint + 1, y + 2, clusterWidth / 2 - 2, CELL_HEIGHT - 4)

      context.font = `600 14px ${UI_FONT}`
      context.textBaseline = 'middle'
      context.fillStyle = sellAlpha > 0.55 ? '#fff8ff' : '#e3bbe9'
      context.textAlign = 'right'
      context.fillText(formatQuantity(level.sellBase), midpoint - 6, y + CELL_HEIGHT / 2)
      context.fillStyle = buyAlpha > 0.55 ? '#effff8' : '#acd8c8'
      context.textAlign = 'left'
      context.fillText(formatQuantity(level.buyBase), midpoint + 6, y + CELL_HEIGHT / 2)

      const imbalance = getImbalance(candle, row)
      if (imbalance.sell) {
        context.strokeStyle = COLORS.sellBright
        context.lineWidth = 2
        context.strokeRect(clusterLeft + 1, y + 3, clusterWidth / 2 - 3, CELL_HEIGHT - 6)
      }
      if (imbalance.buy) {
        context.strokeStyle = COLORS.buyBright
        context.lineWidth = 2
        context.strokeRect(midpoint + 2, y + 3, clusterWidth / 2 - 4, CELL_HEIGHT - 6)
      }
      if (row === candle.pocRow) {
        context.strokeStyle = COLORS.gold
        context.lineWidth = 2
        context.strokeRect(clusterLeft + 1, y + 2, clusterWidth - 3, CELL_HEIGHT - 4)
      }
    }

    const candleX = x + stripWidth / 2
    const rowCenterY = (row) => LAYOUT.top + (ROW_COUNT - 1 - row) * CELL_HEIGHT + CELL_HEIGHT / 2
    const highY = rowCenterY(candle.high)
    const lowY = rowCenterY(candle.low)
    const openY = rowCenterY(candle.open)
    const closeY = rowCenterY(candle.close)
    const rising = candle.close >= candle.open
    context.save()
    if (column === COLUMN_COUNT - 1) context.globalAlpha = 0.72 + livePulse * 0.28
    context.strokeStyle = rising ? COLORS.buy : COLORS.sell
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(candleX, highY)
    context.lineTo(candleX, lowY)
    context.stroke()
    context.fillStyle = rising ? COLORS.buy : COLORS.sell
    context.fillRect(candleX - 3, Math.min(openY, closeY), 6, Math.max(5, Math.abs(closeY - openY)))
    context.restore()
  })

  context.fillStyle = '#686c67'
  context.font = `500 13px ${UI_FONT}`
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  for (let visualRow = 0; visualRow < ROW_COUNT; visualRow += 1) {
    const row = ROW_COUNT - 1 - visualRow
    const y = LAYOUT.top + visualRow * CELL_HEIGHT + CELL_HEIGHT / 2
    context.fillText(priceForRow(row).toLocaleString('en-US'), LAYOUT.left + PLOT_WIDTH + 13, y)
  }

  const statsTop = LAYOUT.top + PLOT_HEIGHT + 20
  const deltaBandTop = statsTop + 32
  const deltaBandHeight = 65
  const maxDelta = Math.max(1, ...candles.map((candle) => Math.abs(candle.delta)))

  context.fillStyle = '#60645f'
  context.font = `600 13px ${UI_FONT}`
  context.textAlign = 'left'
  context.fillText('DELTA', LAYOUT.left, statsTop)

  candles.forEach((candle, column) => {
    const x = LAYOUT.left + column * CELL_WIDTH
    const centerX = x + CELL_WIDTH / 2
    const zeroY = deltaBandTop + deltaBandHeight / 2
    const magnitude = Math.max(2, Math.abs(candle.delta) / maxDelta * (deltaBandHeight / 2 - 4))
    context.fillStyle = candle.delta >= 0 ? COLORS.buy : COLORS.sell
    if (candle.delta >= 0) context.fillRect(x + 10, zeroY - magnitude, CELL_WIDTH - 20, magnitude)
    else context.fillRect(x + 10, zeroY, CELL_WIDTH - 20, magnitude)

    context.fillStyle = candle.delta >= 0 ? '#a7dfca' : '#dfb0e8'
    context.font = `600 13px ${UI_FONT}`
    context.textAlign = 'center'
    context.fillText(formatDelta(candle.delta), centerX, deltaBandTop + deltaBandHeight + 19)
    context.fillStyle = '#5f645f'
    context.font = `500 12px ${UI_FONT}`
    context.fillText(candle.time, centerX, deltaBandTop + deltaBandHeight + 43)
  })

  context.strokeStyle = 'rgba(255, 255, 255, 0.09)'
  context.beginPath()
  context.moveTo(LAYOUT.left, deltaBandTop + deltaBandHeight / 2)
  context.lineTo(LAYOUT.left + PLOT_WIDTH, deltaBandTop + deltaBandHeight / 2)
  context.stroke()

}

function canvasRectToLocal(x, y, width, height) {
  return {
    x: ((x + width / 2) / TEXTURE_WIDTH - 0.5) * BOARD_WIDTH,
    y: (0.5 - (y + height / 2) / TEXTURE_HEIGHT) * BOARD_HEIGHT,
    width: width / TEXTURE_WIDTH * BOARD_WIDTH,
    height: height / TEXTURE_HEIGHT * BOARD_HEIGHT,
  }
}

function selectedCellData(candles, selection) {
  if (!selection) return null
  const candle = candles[selection.column]
  const level = candle?.levels[selection.row]
  if (!candle || !level) return null
  const imbalance = getImbalance(candle, selection.row)
  return {
    ...selection,
    time: candle.time,
    price: priceForRow(selection.row),
    sellBase: level.sellBase,
    buyBase: level.buyBase,
    delta: level.buyBase - level.sellBase,
    poc: candle.pocRow === selection.row,
    imbalance: imbalance.buy ? 'Buy imbalance' : imbalance.sell ? 'Sell imbalance' : null,
  }
}

export default function OrderflowTopology() {
  const mountRef = useRef(null)
  const [probe, setProbe] = useState(null)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !window.WebGLRenderingContext) return undefined

    const candles = buildFootprintData()
    const heatmap = buildHeatmapData()
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60)
    camera.position.set(0.4, 0.15, 14.8)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.dataset.orderflowTopology = 'footprint'
    renderer.domElement.dataset.renderMode = 'on-demand'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    mount.appendChild(renderer.domElement)

    const board = new THREE.Group()
    board.rotation.set(-0.065, -0.205, -0.012)
    board.position.set(0.25, -0.08, 0)
    scene.add(board)

    const backgroundGeometry = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT)
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x030505,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial)
    background.position.z = -0.08
    board.add(background)

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x798078,
      transparent: true,
      opacity: 0.28,
    })
    const boardEdges = new THREE.LineSegments(new THREE.EdgesGeometry(backgroundGeometry), edgeMaterial)
    boardEdges.position.z = -0.04
    board.add(boardEdges)

    const textureCanvas = document.createElement('canvas')
    textureCanvas.width = TEXTURE_WIDTH
    textureCanvas.height = TEXTURE_HEIGHT
    const textureContext = textureCanvas.getContext('2d')
    const boardTexture = new THREE.CanvasTexture(textureCanvas)
    boardTexture.colorSpace = THREE.SRGBColorSpace
    boardTexture.minFilter = THREE.LinearFilter
    boardTexture.magFilter = THREE.LinearFilter
    boardTexture.generateMipmaps = false
    boardTexture.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy())

    const overlayMaterial = new THREE.MeshBasicMaterial({
      map: boardTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT), overlayMaterial)
    overlay.position.z = 0.52
    overlay.renderOrder = 8
    board.add(overlay)

    const instanceCount = COLUMN_COUNT * ROW_COUNT
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
    const sellMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
    const buyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
    const sellBoxes = new THREE.InstancedMesh(boxGeometry, sellMaterial, instanceCount)
    const buyBoxes = new THREE.InstancedMesh(boxGeometry, buyMaterial, instanceCount)
    sellBoxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    buyBoxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    board.add(sellBoxes, buyBoxes)

    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0ca5b,
      transparent: true,
      opacity: 0.12,
      depthTest: false,
      depthWrite: false,
    })
    const selectionPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), selectionMaterial)
    selectionPlane.position.z = 0.58
    selectionPlane.renderOrder = 10
    selectionPlane.visible = false
    board.add(selectionPlane)

    const crosshairGeometry = new THREE.BufferGeometry()
    crosshairGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3))
    const crosshairMaterial = new THREE.LineBasicMaterial({
      color: 0xe8c458,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    })
    const crosshair = new THREE.LineSegments(crosshairGeometry, crosshairMaterial)
    crosshair.renderOrder = 9
    crosshair.visible = false
    board.add(crosshair)

    const dummy = new THREE.Object3D()
    const sellBaseColor = new THREE.Color(0xa64cbd)
    const buyBaseColor = new THREE.Color(0x1eaa76)
    const darkColor = new THREE.Color(0x080a09)
    const instanceColor = new THREE.Color()
    let selection = null
    let isPinned = false
    let liveTick = 0
    let livePulse = 0
    let scrolling = false
    let scrollResumeTimer = 0

    function updateInstances() {
      let instance = 0
      candles.forEach((candle, column) => {
        const maxSide = Math.max(1, ...candle.levels.flatMap((level) => [level.sellBase, level.buyBase]))
        candle.levels.forEach((level, row) => {
          const visualRow = ROW_COUNT - 1 - row
          const cellX = LAYOUT.left + column * CELL_WIDTH
          const cellY = LAYOUT.top + visualRow * CELL_HEIGHT
          const stripWidth = 10
          const clusterLeft = cellX + stripWidth + 3
          const clusterWidth = CELL_WIDTH - stripWidth - 7
          const sideWidth = clusterWidth / 2 - 2
          const sellRect = canvasRectToLocal(clusterLeft, cellY + 3, sideWidth, CELL_HEIGHT - 6)
          const buyRect = canvasRectToLocal(clusterLeft + clusterWidth / 2 + 2, cellY + 3, sideWidth, CELL_HEIGHT - 6)
          const sellRatio = level.sellBase / maxSide
          const buyRatio = level.buyBase / maxSide
          const sellDepth = level.sellBase > 0 ? 0.035 + Math.pow(sellRatio, 0.65) * 0.38 : 0.001
          const buyDepth = level.buyBase > 0 ? 0.035 + Math.pow(buyRatio, 0.65) * 0.38 : 0.001

          dummy.position.set(sellRect.x, sellRect.y, sellDepth / 2)
          dummy.scale.set(sellRect.width, sellRect.height, sellDepth)
          dummy.updateMatrix()
          sellBoxes.setMatrixAt(instance, dummy.matrix)
          const pocBoost = row === candle.pocRow ? 0.22 : 0
          sellBoxes.setColorAt(
            instance,
            instanceColor.copy(darkColor).lerp(sellBaseColor, clamp(footprintAlpha(sellRatio, 0.16, 0.94) + pocBoost, 0, 1)),
          )

          dummy.position.set(buyRect.x, buyRect.y, buyDepth / 2)
          dummy.scale.set(buyRect.width, buyRect.height, buyDepth)
          dummy.updateMatrix()
          buyBoxes.setMatrixAt(instance, dummy.matrix)
          buyBoxes.setColorAt(
            instance,
            instanceColor.copy(darkColor).lerp(buyBaseColor, clamp(footprintAlpha(buyRatio, 0.16, 0.94) + pocBoost, 0, 1)),
          )
          instance += 1
        })
      })
      sellBoxes.instanceMatrix.needsUpdate = true
      buyBoxes.instanceMatrix.needsUpdate = true
      if (sellBoxes.instanceColor) sellBoxes.instanceColor.needsUpdate = true
      if (buyBoxes.instanceColor) buyBoxes.instanceColor.needsUpdate = true
    }

    function updateSelectionVisual() {
      if (!selection) {
        selectionPlane.visible = false
        crosshair.visible = false
        renderer.domElement.dataset.selectedCell = ''
        return
      }

      const visualRow = ROW_COUNT - 1 - selection.row
      const cell = canvasRectToLocal(
        LAYOUT.left + selection.column * CELL_WIDTH,
        LAYOUT.top + visualRow * CELL_HEIGHT,
        CELL_WIDTH,
        CELL_HEIGHT,
      )
      const plot = canvasRectToLocal(LAYOUT.left, LAYOUT.top, PLOT_WIDTH, PLOT_HEIGHT)
      selectionPlane.position.set(cell.x, cell.y, 0.58)
      selectionPlane.scale.set(cell.width * 0.98, cell.height * 0.9, 1)
      selectionPlane.visible = true

      const positions = crosshairGeometry.attributes.position.array
      positions.set([
        plot.x - plot.width / 2, cell.y, 0.57,
        plot.x + plot.width / 2, cell.y, 0.57,
        cell.x, plot.y - plot.height / 2, 0.57,
        cell.x, plot.y + plot.height / 2, 0.57,
      ])
      crosshairGeometry.attributes.position.needsUpdate = true
      crosshair.visible = true
      renderer.domElement.dataset.selectedCell = `${selection.column}:${selection.row}`
    }

    function redrawTexture() {
      drawFootprintTexture(textureContext, candles, heatmap, livePulse)
      boardTexture.needsUpdate = true
    }

    function publishProbe() {
      setProbe(selectedCellData(candles, selection))
      setPinned(isPinned)
      renderer.domElement.dataset.pinned = String(isPinned)
    }

    function setSelection(nextSelection) {
      if (
        selection?.column === nextSelection?.column
        && selection?.row === nextSelection?.row
      ) return
      selection = nextSelection
      updateSelectionVisual()
      publishProbe()
      requestRender()
    }

    updateInstances()
    redrawTexture()

    const pointer = new THREE.Vector2()
    const parallax = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()

    function selectionFromPointer(event) {
      const bounds = mount.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return null
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
      scene.updateMatrixWorld(true)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(overlay, false)[0]
      if (!hit?.uv) return null

      const canvasX = hit.uv.x * TEXTURE_WIDTH
      const canvasY = (1 - hit.uv.y) * TEXTURE_HEIGHT
      if (
        canvasX < LAYOUT.left
        || canvasX >= LAYOUT.left + PLOT_WIDTH
        || canvasY < LAYOUT.top
        || canvasY >= LAYOUT.top + PLOT_HEIGHT
      ) return null

      const column = clamp(Math.floor((canvasX - LAYOUT.left) / CELL_WIDTH), 0, COLUMN_COUNT - 1)
      const visualRow = clamp(Math.floor((canvasY - LAYOUT.top) / CELL_HEIGHT), 0, ROW_COUNT - 1)
      return { column, row: ROW_COUNT - 1 - visualRow }
    }

    const onPointerMove = (event) => {
      if (scrolling) return
      const bounds = mount.getBoundingClientRect()
      parallax.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      parallax.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      if (!isPinned && event.pointerType !== 'touch') setSelection(selectionFromPointer(event))
      requestRender(5)
    }

    const onPointerLeave = () => {
      parallax.set(0, 0)
      if (!isPinned) setSelection(null)
      requestRender(6)
    }

    const onClick = (event) => {
      const nextSelection = selectionFromPointer(event)
      if (!nextSelection) {
        isPinned = false
        setSelection(null)
        publishProbe()
        return
      }

      if (
        isPinned
        && selection?.column === nextSelection.column
        && selection?.row === nextSelection.row
      ) {
        isPinned = false
      } else {
        selection = nextSelection
        isPinned = true
      }
      updateSelectionVisual()
      publishProbe()
      requestRender()
    }

    const onFocus = () => {
      if (!selection) setSelection({ column: COLUMN_COUNT - 1, row: candles.at(-1).close })
    }

    const onKeyDown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape'].includes(event.key)) return
      event.preventDefault()
      if (event.key === 'Escape') {
        isPinned = false
        setSelection(null)
        publishProbe()
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        isPinned = !isPinned
        publishProbe()
        return
      }

      const current = selection ?? { column: COLUMN_COUNT - 1, row: candles.at(-1).close }
      setSelection({
        column: clamp(current.column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0), 0, COLUMN_COUNT - 1),
        row: clamp(current.row + (event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0), 0, ROW_COUNT - 1),
      })
    }

    mount.addEventListener('pointermove', onPointerMove, { passive: true })
    mount.addEventListener('pointerleave', onPointerLeave)
    mount.addEventListener('click', onClick)
    mount.addEventListener('focus', onFocus)
    mount.addEventListener('keydown', onKeyDown)

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

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reducedMotion = reducedMotionQuery.matches
    let visible = true
    let frame = 0
    let renderedFrames = 0
    let settleFrames = 0
    const start = performance.now()

    function requestRender(frames = 1) {
      settleFrames = Math.max(settleFrames, frames)
      if (visible && !scrolling && !frame) frame = requestAnimationFrame(render)
    }

    const onScroll = () => {
      if (!visible) return
      scrolling = true
      renderer.domElement.dataset.scrollPaused = 'true'
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      window.clearTimeout(scrollResumeTimer)
      scrollResumeTimer = window.setTimeout(() => {
        scrolling = false
        renderer.domElement.dataset.scrollPaused = 'false'
        requestRender(1)
      }, 140)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) requestRender(2)
      else if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    })
    intersectionObserver.observe(mount)

    function sampleCanvasPixels() {
      if (!import.meta.env.DEV || renderedFrames !== 1) return
      const gl = renderer.getContext()
      const sampleWidth = Math.min(112, gl.drawingBufferWidth)
      const sampleHeight = Math.min(72, gl.drawingBufferHeight)
      const pixels = new Uint8Array(sampleWidth * sampleHeight * 4)
      const sampleX = Math.max(0, Math.floor((gl.drawingBufferWidth - sampleWidth) / 2))
      const sampleY = Math.max(0, Math.floor((gl.drawingBufferHeight - sampleHeight) / 2))
      gl.readPixels(sampleX, sampleY, sampleWidth, sampleHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

      let litPixels = 0
      let signature = 2166136261
      for (let index = 0; index < pixels.length; index += 4) {
        const value = pixels[index] + pixels[index + 1] + pixels[index + 2]
        if (value > 18) litPixels += 1
        signature ^= value
        signature = Math.imul(signature, 16777619)
      }
      renderer.domElement.dataset.litPixels = String(litPixels)
      renderer.domElement.dataset.pixelSignature = String(signature >>> 0)
    }

    function render(now) {
      frame = 0
      if (!visible || scrolling) return
      const elapsed = (now - start) / 1000
      livePulse = reducedMotion ? 0.6 : (Math.sin(elapsed * 2.7) + 1) / 2
      const targetY = -0.205 + parallax.x * 0.055
      const targetX = -0.065 - parallax.y * 0.032
      board.rotation.y += (targetY - board.rotation.y) * 0.16
      board.rotation.x += (targetX - board.rotation.x) * 0.16
      selectionMaterial.opacity = 0.09 + livePulse * 0.07
      crosshairMaterial.opacity = 0.38 + livePulse * 0.18

      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      renderedFrames += 1
      renderer.domElement.dataset.renderedFrames = String(renderedFrames)
      sampleCanvasPixels()

      settleFrames = Math.max(0, settleFrames - 1)
      const unsettled = Math.abs(targetY - board.rotation.y) > 0.0005
        || Math.abs(targetX - board.rotation.x) > 0.0005
      if (!reducedMotion && (settleFrames > 0 || unsettled)) {
        frame = requestAnimationFrame(render)
      }
    }

    const liveInterval = window.setInterval(() => {
      if (!visible || scrolling || reducedMotion || document.hidden) return
      liveTick += 1
      advanceFormingCandle(candles.at(-1), liveTick)
      advanceHeatmap(heatmap, liveTick)
      updateInstances()
      redrawTexture()
      renderer.domElement.dataset.liveTick = String(liveTick)
      if (selection?.column === COLUMN_COUNT - 1) publishProbe()
      requestRender(1)
    }, 1050)

    requestRender(2)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(scrollResumeTimer)
      window.clearInterval(liveInterval)
      window.removeEventListener('scroll', onScroll)
      intersectionObserver.disconnect()
      resizeObserver.disconnect()
      mount.removeEventListener('pointermove', onPointerMove)
      mount.removeEventListener('pointerleave', onPointerLeave)
      mount.removeEventListener('click', onClick)
      mount.removeEventListener('focus', onFocus)
      mount.removeEventListener('keydown', onKeyDown)
      boardTexture.dispose()
      scene.traverse((object) => {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
        else object.material?.dispose()
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className={`tn-orderflow-topology${probe ? ' is-inspecting' : ''}${pinned ? ' is-pinned' : ''}`}
      role="region"
      tabIndex={0}
      aria-label="Interactive BTC footprint preview. Use the arrow keys to inspect price levels, Enter to pin, and Escape to clear."
    >
      <div className="tn-footprint-probe" aria-live="polite">
        {probe && (
          <>
            <span>{probe.time} / {probe.price.toLocaleString('en-US')}</span>
            {probe.sellBase === 0 && probe.buyBase === 0
              ? <strong><em className="is-empty">No trades</em></strong>
              : (
                <strong>
                  <i className="is-sell">{formatQuantity(probe.sellBase)}</i>
                  <b>/</b>
                  <i className="is-buy">{formatQuantity(probe.buyBase)}</i>
                </strong>
              )}
            <small>
              {probe.sellBase === 0 && probe.buyBase === 0
                ? 'No executed volume at level'
                : (
                  `Delta ${formatDelta(probe.delta)}${probe.poc ? ' / Highest-volume level' : probe.imbalance ? ` / ${probe.imbalance}` : ''}`
                )}
            </small>
          </>
        )}
      </div>
    </div>
  )
}
