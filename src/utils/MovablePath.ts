import { Vector } from "./Vector"

export type MovablePathOptions = MovablePath['options']

/**
 * a movable path in canvas
 */
export class MovablePath {
    /**the canvas that path should render on */
    canvas: HTMLCanvasElement
    
    /**canvas rendering context */
    ctx: CanvasRenderingContext2D

    /**path options */
    options = {
        allowModify: true,
        pointRadius: 5
    }
    
    /**
     * select method
     * + single: only allow single point be modify at a time
     * + select: allow all select point be modify at a time
     */
    target: 'single' | 'select' = 'single'

    /**movable points */
    points: Record<string, Vector> = {}

    /**focusing point(s) */
    focusedPoints: Record<string, Vector> = {}

    /**pointer info */
    pointer = {
        position: null as Vector | null,
        isDown: false
    }

    /**point position history */
    pointPositionHistory: Record<string, Vector>[] = []

    nextPointPositionHistory: Record<string, Vector>[] = []

    historyCommitTimeout?: ReturnType<typeof setTimeout>

    /**
     * 
     * @param canvas the canvas that need to draw on
     * @param render canvas render function
     * @param options path options
     */
    constructor(canvas: HTMLCanvasElement, options: Partial<MovablePathOptions> = {}) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        this.setOptions(options)
        this.#addListenerToPoints()
    }

    /**set path options */
    setOptions = (options: Partial<MovablePathOptions>) => {
        let isModify = false

        Object.entries(options).forEach(([key, value]) => {
            // @ts-ignore
            if(value !== this.options[key]) {
                isModify = true
                //@ts-ignore
                this.options[key] = value
            }
        })

        if(isModify) {
            this.#addListenerToPoints()
        }
    }

    /**add movable points */
    addPoints = (...points: Vector[]) => {
        points.forEach(p => {
            this.points[p.id] = p
        })
        
        this.#addListenerToPoints()
    }

    /**remove movable points */
    removePoints = (...points: Vector[]) => {
        points.forEach(p => {
            delete this.points[p.id]
        })
        
        this.#addListenerToPoints()
    }

    /**set point visible radius */
    setPointRadius = (radius: number) => {
        this.options.pointRadius = radius
        this.#addListenerToPoints()
    }

    /**set the draw canvas */
    setCanvas = (canvas: HTMLCanvasElement) => {
        this.#removePointsListener()
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        this.#addListenerToPoints()
    }

    /**select points */
    select = (...points: Vector[]) => {
        this.#tryFocus(...points)
    }

    /**select all added points */
    selectAll = () => {
        this.#tryFocus(...Object.values(this.points))
    }

    /**deselect points */
    deselect = (...points: Vector[]) => {
        points.forEach(p => {
            delete this.focusedPoints[p.id]
        })

        this.#onChangeFocusedPoints()
    }

    /**deselect all focused points */
    deselectAll = () => {
        this.focusedPoints = {}

        this.#onChangeFocusedPoints()
    }

    /**canvas render function */
    render: () => unknown = () => {}

    /**on any point focus or blur, this function trigger */
    onPointFocusedChange: (focusedPoints: Record<string, Vector>) => unknown = () => {}

    /**clean up listeners */
    #removePointsListener = () => {
        this.canvas.removeEventListener('pointerdown', this.#handlePointerDown)
        this.canvas.removeEventListener('pointermove', this.#handlePointerMove)
        this.canvas.removeEventListener('pointerup', this.#handlePointerUp)
        this.canvas.removeEventListener('pointerleave', this.#handlePointerUp)
    }

    /**add default listeners */
    #addListenerToPoints = () => {
        this.#removePointsListener()

        if(this.options.allowModify) {
            this.canvas.addEventListener('pointerdown', this.#handlePointerDown)

            this.canvas.addEventListener('pointermove', this.#handlePointerMove)

            this.canvas.addEventListener('pointerup', this.#handlePointerUp)

            this.canvas.addEventListener('pointerleave', this.#handlePointerUp)
        }

        this.#onChangeFocusedPoints()
    }

    #getPointerPositionOnCanvasFromEvent = (e: PointerEvent) => {
        const rect = this.canvas.getBoundingClientRect()
        const scaleX = this.canvas.width / rect.width
        const scaleY = this.canvas.height / rect.height

        return new Vector((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    }

    /**handle pointer down */
    #handlePointerDown = (e: PointerEvent) => {
        this.pointer.isDown = true

        const clickPosition = this.#getPointerPositionOnCanvasFromEvent(e)

        const point = this.#findNearestPointOnPosition(clickPosition, this.options.pointRadius * 1.05)

        if(point) {
            this.#tryFocus(point)

            this.#onChangeFocusedPoints()

            this.canvas.setPointerCapture(e.pointerId)
        }

        this.#updatePointerPosition(clickPosition)
    }

    /**handle pointer move */
    #handlePointerMove = (e: PointerEvent) => {
        const clickPosition = this.#getPointerPositionOnCanvasFromEvent(e)

        this.#updatePointerPosition(clickPosition)
    }

    /**handle pointer up */
    #handlePointerUp = (e: PointerEvent) => {
        this.pointer.isDown = false

        if(this.target === 'single') this.deselectAll()

        this.#updatePointerPosition(null)

        try {
            this.canvas.releasePointerCapture(e.pointerId)
        } catch {}
    }

    /**update pointer position and update focus point position */
    #updatePointerPosition = (position: Vector | null) => {
        if(this.pointer.position && position) {
            if(this.pointer.isDown) {
                const ps = Object.values(this.focusedPoints)

                ps.forEach(point => {
                    point.subtract(this.pointer.position!).plus(position)
                })
            }
        }

        this.render()

        this.pointer.position = position
    }

    /**
     * find nearest possible point that user click on
     * @param position position to check
     * @param maxAcceptDistance max accept distance between nearest point and position
     * @returns 
     */
    #findNearestPointOnPosition = (position: Vector, maxAcceptDistance = 5) => {
        const [nearestPoint, nearestDistance] = Object.values(this.points).reduce((pair, point) => {
            const dist = point.distance(position)

            if(dist > pair[1]) {
                return pair
            } else {
                return [point, dist] as const
            }
        }, [new Vector(), Infinity] as const)

        if(nearestDistance > maxAcceptDistance) {
            return null
        } else {
            return nearestPoint
        }
    }

    /**try focus on points */
    #tryFocus = (...points: Vector[]) => {
        points.forEach(point => {
            if(this.focusedPoints[point.id]) return

            if(this.target === 'single') {
                this.focusedPoints = {
                    [point.id]: point
                }
            } else if(this.target === 'select') {
                this.focusedPoints[point.id] = point
            }
        })

        this.#onChangeFocusedPoints()
    }

    /**on any change occur on {@link focusedPoints} */
    #onChangeFocusedPoints = () => {
        this.onPointFocusedChange(this.focusedPoints)
    }
}