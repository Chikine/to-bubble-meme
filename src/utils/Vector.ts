/**
 * use as a point on canvas context 2d
 */
export class Vector {
    /**x coordinate of vector */
    x = 0

    /**y coordinate of vector */
    y = 0

    /**vector id */
    id = crypto.randomUUID()

    /**
     * Create a vector2 , default is vector zero (0,0)
     */
    constructor(x = 0, y = 0) {
        this.x = x
        this.y = y
    }

    /**
     * set position for vector
     */
    set(x: number, y: number) {
        this.x = x
        this.y = y

        return this
    }

    /**
     * copy another vector
     */
    copy(vector: Vector) {
        Object.assign(this, {
            x: vector.x,
            y: vector.y
        })
    }

    /**
     * clone this vector
     */
    clone() {
        return new Vector(this.x, this.y)
    }

    /**
     * deep clone this vector, the return vector will contains this vector:
     * + coordinate
     * + save data
     * + id
     */
    deepClone() {
        const vector = new Vector()

        if(this.#saveData) {
            vector.copy(this.#saveData)

            this.save()
        }

        vector.copy(this)

        vector.id = this.id

        return vector
    }

    /**
     * turn vector into origin point (x = 0, y = 0, z = 0)
     */
    zero() {
        this.x = 0
        this.y = 0
    }

    /**
     * compare this position to another vector position
     */
    isEqual(vector: Vector) {
        return this.x === vector.x && this.y === vector.y
    }

    /**
     * subtract this vector to a vector
     */
    subtract(vector: Vector, multiply = 1) {
        this.x -= vector.x * multiply
        this.y -= vector.y * multiply
        return this
    }

    /**
     * plus this vector with a vector
     */
    plus(vector: Vector, multiply = 1) {
        this.x += vector.x * multiply
        this.y += vector.y * multiply
        return this
    }
    
    /**
     * multiply x and y of vector
     */
    multiply(rate: number) {
        this.x *= rate
        this.y *= rate
        return this
    }
    
    /**
     * divide x and y of vector
     */
    divide(rate: number) {
        this.x /= rate
        this.y /= rate
        return this
    }

    /**
     * create a dot on canvas context
     * 
     * only use after any previous path is draw completely
     */
    dot(ctx: CanvasRenderingContext2D,options: {color?: string, radius?: number} = {}) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(this.x, this.y, options.radius || 1, 0, Math.PI * 2)
        ctx.fillStyle = options.color || 'red'
        ctx.fill()
        ctx.restore()
    }

    #saveData: Vector | null = null

    /**
     * save vector
     */
    save() {
        this.#saveData = this.clone()
    }

    /**
     * restore vector
     */
    restore() {
        if(this.#saveData !== null) {
            this.copy(this.#saveData)
        }
    }

    /**
     * return distance with another vector
     */
    distance(vector: Vector) {
        return Math.sqrt((this.x - vector.x) ** 2 + (this.y - vector.y) ** 2)
    }

    /**
     * mormalize the vector base on origin point
     */
    normalize(origin = new Vector()) {
        const angle = this.angleFrom(origin)
        const newVec = origin.getVectorTo(angle, 1)
        this.copy(newVec)
    }

    /**
     * get angle from a vector to this
     */
    angleFrom(vector = new Vector()) {
        const x = this.x - vector.x
        const y = this.y - vector.y
        return Math.atan2(y, x)
    }

    /**
     * get vector to a point with radian angle and distance
     */
    getVectorTo(angle: number, distance: number) {
        const x = this.x + distance * Math.cos(angle)
        const y = this.y + distance * Math.sin(angle)
        return new Vector(x, y)
    }

    /**
     * [x, y]
     */
    array() {
        return [this.x, this.y] as const
    }

    get string() {
        return '>>> Vector \n+ x: ' + this.x + '\n+ y: ' + this.y + '\n'
    }

    /**stringify method */
    toJSON() {
        return {
            x: this.x,
            y: this.y,
            id: this.id
        }
    }
}