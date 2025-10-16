import { MovablePath } from "./MovablePath"
import { Vector } from "./Vector"

/**a crop box that can crop image on canvas */
export class CropBox {
    /**canvas that will draw on */
    canvas: HTMLCanvasElement

    /**the {@link canvas} rendering context */
    ctx: CanvasRenderingContext2D

    /**crop move handler */
    movablePath: MovablePath

    /**top left */
    tl: Vector

    /**bottom right */
    br: Vector

    /**top right */
    tr: Vector

    /**bottom left */
    bl: Vector

    /**top */
    t = new Vector()

    /**bottom */
    b = new Vector()

    /**left */
    l = new Vector()

    /**right */
    r = new Vector()

    /**crop options */
    options = {
        /**the crop / box color */
        boxColor: '#000000',

        /**make outside of the crop area being shadow */
        blurOutside: true,

        /**side length*/
        sideLength: 40,

        /**side width*/
        sideWidth: 10,

        /**show the box or not */
        showBox: true
    }

    constructor(canvas: HTMLCanvasElement, options: Partial<typeof this.options> = {}) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!

        this.setOptions(options)

        this.tl = new Vector(0, 0)

        this.br = new Vector(canvas.width, canvas.height).subtract(this.tl)

        this.tr = new Vector(this.br.x, this.tl.y)

        this.bl = new Vector(this.tl.x, this.br.y)

        this.#updateSidePositions()

        this.movablePath = new MovablePath(canvas, {
            pointRadius: options.sideLength,
            allowModify: true
        })

        this.movablePath.addPoints(this.tl, this.tr, this.bl, this.br, this.t, this.b, this.l, this.r)

        this.movablePath.render = this.render
    }

    /**set crop options */
    setOptions = (options: Partial<typeof this.options> = {}) => {
        Object.assign(this.options, options)
    }

    /**is canvas is cropping ? */
    get isCropping() {
        return !!Object.values(this.movablePath.focusedPoints).length
    }

    /**box color in lower opacity */
    get boxColorBlur() {
        return this.options.boxColor.slice(1).split('').map(ch => ({a:10, b:11, c:12, d:13, e:14, f:15}[ch.toLowerCase()] || parseInt(ch))).reduce(([str, prev], num, i) => i % 2 ? [str + (prev * 16 + num) + ',', 0] as const : [str, num] as const, ['rgba(' as string, 0 as number] as const)[0] + '0.5)'
    }

    /**enable modify crop corner */
    set enableCrop(enable: boolean) {
        this.options.showBox = enable

        this.movablePath.setOptions({allowModify: enable})
    }

    /**
     * canvas render function
     * @remark 
     * + this is the function to render the canvas, not the function to render this box,
     * and you must provide it
     * + to render the box, use {@link draw} inside the canvas render function, and attach to this
     */
    render: () => unknown = () => {}

    /**draw the crop box */
    draw = () => {
        //init
        this.#handleOverCrop()

        this.#updatePointPositions()

        //lower opacity color
        const color = this.boxColorBlur

        const { sideWidth: width, sideLength: length, blurOutside, showBox} = this.options

        //if not allow to show, return
        if(!showBox) return

        //create box
        this.ctx.save()
        this.ctx.fillStyle = this.options.boxColor

        //corners
        this.ctx.fillRect(this.tl.x, this.tl.y, width, length)
        this.ctx.fillRect(this.tl.x, this.tl.y, length, width)

        this.ctx.fillRect(this.br.x - width, this.br.y - length, width, length)
        this.ctx.fillRect(this.br.x - length, this.br.y - width, length, width)

        this.ctx.fillRect(this.tr.x - width, this.tr.y, width, length)
        this.ctx.fillRect(this.tr.x - length, this.tr.y, length, width)

        this.ctx.fillRect(this.bl.x, this.bl.y - width, length, width)
        this.ctx.fillRect(this.bl.x, this.bl.y - length, width, length)

        //sides
        this.ctx.fillRect(this.t.x - length / 2, this.tl.y, length, width) //top

        this.ctx.fillRect(this.b.x - length / 2, this.br.y - width, length, width) //bottom

        this.ctx.fillRect(this.tl.x, this.l.y - length / 2, width, length) //left

        this.ctx.fillRect(this.br.x - width, this.r.y - length / 2, width, length) // right

        //grid
        if(this.isCropping) {
            
            this.ctx.fillStyle = color

            const sx = this.tr.x - this.tl.x
            const sy = this.bl.y - this.tl.y

            this.ctx.fillRect(this.tl.x + sx / 3 - width / 2, this.tl.y, width, this.br.y - this.tl.y)

            this.ctx.fillRect(this.tl.x + sx * 2 / 3 - width / 2, this.tl.y, width, this.br.y - this.tl.y)

            this.ctx.fillRect(this.tl.x, this.tl.y + sy / 3 - width / 2, this.br.x - this.tl.x, width)

            this.ctx.fillRect(this.tl.x, this.tl.y + sy * 2 / 3 - width / 2, this.br.x - this.tl.x, width)
        }

        //outside box
        if(blurOutside) {
            this.ctx.fillRect(0, 0, this.canvas.width, this.tr.y)
            this.ctx.fillRect(0, this.br.y, this.canvas.width, this.canvas.height)
            this.ctx.fillRect(0, 0, this.tl.x, this.canvas.height)
            this.ctx.fillRect(this.br.x, 0, this.canvas.width, this.canvas.height)
        }

        this.ctx.restore()
    }

    /**update corner position */
    #updatePointPositions = () => {
        const keys = Object.keys(this.movablePath.focusedPoints)

        const test = (...points: Vector[]) => points.some(p => keys.includes(p.id))

        if(test(this.tl, this.br)) {
            this.bl.set(this.tl.x, this.br.y) //tl  tr
            this.tr.set(this.br.x, this.tl.y) //bl  br


        } else if(test(this.bl, this.tr)) {
            this.tl.set(this.bl.x, this.tr.y)
            this.br.set(this.tr.x, this.bl.y)
        } else if(test(this.t)) {
            this.tl.y = this.t.y
            this.tr.y = this.t.y
        } else if(test(this.b)) {
            this.bl.y = this.b.y
            this.br.y = this.b.y
        } else if(test(this.l)) {
            this.tl.x = this.l.x
            this.bl.x = this.l.x
        } else if(test(this.r)) {
            this.tr.x = this.r.x
            this.br.x = this.r.x
        }

        this.#updateSidePositions()
    }

    /**update side positions */
    #updateSidePositions = () => {
        this.t.set(0,0).plus(this.tl).plus(this.tr).divide(2)

        this.b.set(0,0).plus(this.bl).plus(this.br).divide(2)

        this.l.set(0,0).plus(this.tl).plus(this.bl).divide(2)

        this.r.set(0,0).plus(this.br).plus(this.tr).divide(2)
    }

    /**handle if use over crop */
    #handleOverCrop = () => {
        this.tl.x = Math.min(this.tl.x, this.br.x, this.canvas.width)
        this.tl.y = Math.min(this.tl.y, this.br.y, this.canvas.height)

        this.br.x = Math.max(this.tl.x, this.br.x, 0)
        this.br.y = Math.max(this.tl.y, this.br.y, 0) 

        this.bl.x = Math.min(this.bl.x, this.tr.x, this.canvas.width)
        this.bl.y = Math.max(this.bl.y, this.tr.y, 0)

        this.tr.x = Math.max(this.bl.x, this.tr.x, 0)
        this.tr.y = Math.min(this.bl.y, this.tr.y, this.canvas.height)
    }

    /**get cropped image on canvas */
    getCroppedImageUrl() {
        const [width, height] = this.br.clone().subtract(this.tl).array()

        const _canvas = document.createElement('canvas')
        _canvas.width = width
        _canvas.height = height
        const _ctx = _canvas.getContext('2d')!

        _ctx.drawImage(this.canvas, this.tl.x, this.tl.y, width, height, 0, 0, width, height)

        const base64Img = _canvas.toDataURL("image/png", 1)

        return base64Img
    }
}