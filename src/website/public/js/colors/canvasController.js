let calculating = false

let canvasController = {
  /** @type {CanvasRenderingContext2D} */
  ctx: null,
  colorCtx: null,
  currentImage: null,
  currentColor: null,

  getContext() {
    if (canvasController.ctx) {
      return canvasController.ctx
    }

    canvasController.ctx = uiElements.currentImage.getContext("2d", { willReadFrequently: true })

    return canvasController.ctx
  },

  getColorContext() {
    if (canvasController.colorCtx) {
      return canvasController.colorCtx
    }

    canvasController.colorCtx = uiElements.currentColor.getContext("2d")

    return canvasController.colorCtx
  },

  setImage(image, width, height, restore = false) {
    uiElements.currentImage.width = width
    uiElements.currentImage.height = height

    let ctx = canvasController.getContext()
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0)

    canvasController.currentImage = image

    if (!restore) {
      canvasController.deselect()
    }
  },

  deselect() {
    canvasController.currentColor = null
    uiElements.colorSpan.style.color = "red"
    updateSelection = true
  },

  setColor(r, g, b) {
    let ctx = canvasController.getColorContext()
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.fillRect(0, 0, 30, 30)
  },

  setColorToPixel(x, y, selected) {
    let [r, g, b] = canvasController.getContext().getImageData(x, y, 1, 1).data

    if (isNaN(r) || isNaN(g) || isNaN(b)) return

    uiElements.colorSpan.innerText = `rgb(${Math.floor(r * 100) / 100}, ${Math.floor(g * 100) / 100}, ${Math.floor(b * 100) / 100})`
    if (selected) {
      canvasController.currentColor = [r, g, b]
      uiElements.colorSpan.style.color = "lime"
    } else {
      canvasController.currentColor = null
      uiElements.colorSpan.style.color = "red"
    }

    canvasController.setColor(r, g, b)
  },

  getAverageColorLab(ctx, midPoint, width, height) {
    let datas = []

    let startX = Math.floor(midPoint[0] - width / 2)
    let startY = Math.floor(midPoint[1] - height / 2)

    let endX = Math.floor(midPoint[0] + width / 2)
    let endY = Math.floor(midPoint[1] + height / 2)

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        let [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
        if (a != 0) {
          datas.push([r, g, b])
        }
      }
    }

    let l = 0
    let a = 0
    let b = 0

    for (let data of datas) {
      let [r, g, bl] = data

      let asLab = rgb2lab([r, g, bl])

      l += asLab[0]
      a += asLab[1]
      b += asLab[2]
    }

    return [l / datas.length, a / datas.length, b / datas.length]
  },

  setSelection(points) {
    let xSorted = points.toSorted((a, b) => a[0] - b[0])
    let ySorted = points.toSorted((a, b) => a[1] - b[1])

    let biggestDiffX = xSorted[xSorted.length - 1][0] - xSorted[0][0]
    let biggestDiffY = ySorted[ySorted.length - 1][1] - ySorted[0][1]

    let midPoint = calculateMidPoint(points)

    let originCtx = canvasController.getContext()

    let invisible = document.createElement("canvas")
    invisible.width = originCtx.canvas.width
    invisible.height = originCtx.canvas.height

    let ctx = invisible.getContext("2d", { willReadFrequently: true })

    let path = new Path2D()

    path.moveTo(points[0][0], points[0][1])

    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i][0], points[i][1])
    }

    ctx.clip(path)

    ctx.drawImage(canvasController.currentImage, 0, 0)

    let w = biggestDiffX + 10 > ctx.canvas.width ? ctx.canvas.width : biggestDiffX + 10
    let h = biggestDiffY + 10 > ctx.canvas.height ? ctx.canvas.height : biggestDiffY + 10

    averageLab = canvasController.getAverageColorLab(ctx, midPoint, w, h)

    let [r, g, b] = lab2rgb(averageLab)

    if (isNaN(r) || isNaN(g) || isNaN(b)) return

    canvasController.setColor(r, g, b)

    canvasController.currentColor = [r, g, b]
    uiElements.colorSpan.innerText = `rgb(${Math.floor(r * 100) / 100}, ${Math.floor(g * 100) / 100}, ${Math.floor(b * 100) / 100})`
    uiElements.colorSpan.style.color = "lime"
  },

  restoreCanvas() {
    canvasController.setImage(canvasController.currentImage, canvasController.currentImage.width, canvasController.currentImage.height, true)
  },

  updateVisibleSelection(points) {
    let ctx = canvasController.getContext()
    if (points.length <= 1) {
      return
    }

    canvasController.restoreCanvas()

    ctx.setLineDash([5, 3])
    ctx.strokeStyle = "black"
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let index = 0; index < points.length; index++) {
      let point = points[index]
      if (index == 0) {
        ctx.moveTo(point[0], point[1])
      } else {
        ctx.lineTo(point[0], point[1])
      }
    }

    ctx.lineTo(points[0][0], points[0][1])
    ctx.fill()
    ctx.stroke()
    ctx.closePath()
  }
}

function lab2rgb(lab) {
  let y = (lab[0] + 16) / 116,
    x = lab[1] / 500 + y,
    z = y - lab[2] / 200,
    r, g, b

  x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16 / 116) / 7.787)
  y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16 / 116) / 7.787)
  z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16 / 116) / 7.787)

  r = x * 3.2406 + y * -1.5372 + z * -0.4986
  g = x * -0.9689 + y * 1.8758 + z * 0.0415
  b = x * 0.0557 + y * -0.2040 + z * 1.0570

  r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1 / 2.4) - 0.055) : 12.92 * r
  g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1 / 2.4) - 0.055) : 12.92 * g
  b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1 / 2.4) - 0.055) : 12.92 * b

  return [Math.max(0, Math.min(1, r)) * 255,
  Math.max(0, Math.min(1, g)) * 255,
  Math.max(0, Math.min(1, b)) * 255
  ]
}

function rgb2lab(rgb) {
  let r = rgb[0] / 255,
    g = rgb[1] / 255,
    b = rgb[2] / 255,
    x, y, z

  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

  x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000
  z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

  x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116
  y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116
  z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116

  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}

function calculateMidPoint(points) {
  let x = 0
  let y = 0

  for (let point of points) {
    x += point[0]
    y += point[1]
  }

  return [x / points.length, y / points.length]
}

function getMousePos(canvas, e) {
  let rect = canvas.getBoundingClientRect(),
    scaleX = canvas.width / rect.width,
    scaleY = canvas.height / rect.height

  return [
    (e.clientX - rect.left) * scaleX,
    (e.clientY - rect.top) * scaleY
  ]
}

let updateSelection = true

let mouseDown = false
let mouseMoved = false

let saved = false

let points = []

uiElements.currentImage.addEventListener("mousedown", (e) => {
  e.preventDefault()

  if (calculating) return

  canvasController.restoreCanvas()

  let pos = getMousePos(uiElements.currentImage, e)

  points.push(pos)

  updateSelection = true
  mouseDown = true
})

uiElements.currentImage.addEventListener("mouseup", (e) => {
  e.preventDefault()
  if (calculating) return
  calculating = true

  mouseDown = false

  updateSelection = false

  if (!mouseMoved || points.length < 5) {
    let pos = getMousePos(uiElements.currentImage, e)

    canvasController.setColorToPixel(pos[0], pos[1], true)
  } else {
    points.push(points[0])

    canvasController.updateVisibleSelection(points)
    canvasController.setSelection(points)
  }

  mouseMoved = false
  points.length = 0

  calculating = false
})

uiElements.currentImage.addEventListener("mousemove", (e) => {
  e.preventDefault()

  if (calculating) return

  if (e.shiftKey) {
    if (!mouseDown) canvasController.restoreCanvas()
    updateSelection = true
  }

  let pos = getMousePos(uiElements.currentImage, e)

  if (mouseDown) {
    points.push(pos)
    if (!updateSelection) return
    mouseMoved = true
    canvasController.updateVisibleSelection(points)
  } else {
    if (!updateSelection) return

    canvasController.setColorToPixel(pos[0], pos[1], false)
  }
})