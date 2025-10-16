import * as FilePond from 'filepond';
import { plugins } from './filepondPlugins';
import { Vector } from './utils/Vector';
import { MovablePath } from './utils/MovablePath';
import { CropBox } from './utils/CropBox';
import LZString from 'lz-string';

const pathname = window.location.pathname

//keeps only the route that has id === pathname
document.querySelectorAll('.route')?.forEach(elem => elem.id !== pathname && elem.remove())

function navigate(to: string) {
    window.location.href = window.location.origin + to
}

//pathname = /
if(pathname === '/') {
    //elements
    const continueButton = document.getElementById('continue-button') as HTMLButtonElement

    // Register plugins
    FilePond.registerPlugin(
        ...plugins
    );

    // Create FilePond instance
    const inputElement = document.querySelector('input[type="file"]') as HTMLInputElement

    const pond = FilePond.create(inputElement, {
        acceptedFileTypes: ['image/*'],
        maxFiles: 1,
        allowMultiple: true,
        allowPaste: true,   // paste images from clipboard
        allowDrop: true,    // drag & drop
        allowBrowse: true,  // file picker
        labelIdle: 'Drop or Paste your image here or <span class="filepond--label-action">Browse</span>',
        labelFileProcessing: 'Uploading...',
        labelFileProcessingComplete: 'Upload complete',
        labelFileProcessingError: 'Upload error',
        allowFileEncode: true
    });

    // load file from URL
    function addFileFromURL(url: string) {
        pond.addFile(url).catch(error => {
            // remove if FilePond somehow added before rejecting
            if (error && error.file && error.file.id) {
                pond.removeFile(error.file.id)
            }
        });
    }

    //check if valid input
    function isValidInput() {
        const isValid = pond.getFiles().length

        const grayBgClass = 'bg-gray-500/80'
        const greenBgClass = 'bg-green-500'

        if(isValid) {
            continueButton.classList.remove(grayBgClass)
            continueButton.classList.add(greenBgClass)
        } else {
            continueButton.classList.add(grayBgClass)
            continueButton.classList.remove(greenBgClass)
        }
    }
    isValidInput()

    // Fires when a validation error occurs
    pond.on('warning', (error) => {
        alert(`Warning: ${error.body}`);
        console.log(error)
    });

    //handle url input
    document.getElementById('url-input')!.addEventListener('click', () => {
        const url = prompt('enter image url:')
        if(url) {
            addFileFromURL(url)
        }
    })

    //handle any valid file input
    pond.on('addfile', isValidInput)
    pond.on('removefile', isValidInput)

    //handle button
    continueButton.addEventListener('click', () => {
        const image = pond.getFiles()[0] || null
        if(image) {
            const sessionLocation = crypto.randomUUID()
            const base64 = image.getFileEncodeDataURL()
            const compressed = LZString.compress(base64)

            sessionStorage.setItem(sessionLocation, compressed)

            navigate('/create?imageId=' + sessionLocation)
        }
    })
}

//pathname = /create
if(pathname === '/create') {
    //get search
    const search = Object.fromEntries(window.location.search.slice(1).split('&').map(s => s.split('=')) || [])

    //get image id from session storage
    const imageId = search['imageId'] || ''

    //if no image return to /
    if(!imageId) {
        navigate('/')
    }

    //get image src
    const imageSrc = LZString.decompress(sessionStorage.getItem(imageId) || '')

    //elements
    const backButton = document.getElementById('back-button') as HTMLButtonElement

    backButton.addEventListener('click', () => {
        navigate('/')
    })

    const img = new Image()
    img.src = imageSrc

    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!

    const maskCanvas = document.getElementById('mask-canvas') as HTMLCanvasElement
    const maskCtx = maskCanvas.getContext('2d')!

    img.onload = () => {
        let { width, height } = img
        const aspectRatio = width + '/' + height
        const ratio = 3/2

        width *= ratio
        height *= ratio

        canvas.width = width
        canvas.height = height
        canvas.style.aspectRatio = aspectRatio

        maskCanvas.width = width / ratio
        maskCanvas.height = height / ratio

        maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height)

        const offsetX = width / 20
        const offsetY = height / 12

        const A = new Vector(width / 6, 0)                              //start point 
        const B = new Vector(width / 2 - offsetX, height / 6 - offsetY) // point between bubble and tip
        const C = new Vector(width/ 2, height / 6)                      //tip
        const D = new Vector(width / 2 + offsetX, height / 6 - offsetY) // point between bubble and tip
        const E = new Vector(width * 5 / 6, 0)                          //end

        const availConnectMethods = ['bezierCurveTo', 'lineTo', 'quadraticCurveTo'] as const

        type ConnectMethodKey = typeof availConnectMethods[number]

        const connectMethod: Record<string, ConnectMethodKey> = {
            AB: 'quadraticCurveTo',
            BC: 'lineTo',
            CD: 'lineTo',
            DE: 'quadraticCurveTo'
        }

        const _radius = Math.min(img.width, img.height) / 40

        //draw options
        const options = {
            enableCrop: true,
            displayPointsAsDots: true,
            fillTopWithBubbleColor: true,
            moveAllPointAtOnce: false,
            bubbleColor: '#FFFFFF',
            strokeColor: '#000000',
            lineWidth: _radius,
        }

        //add method to crop and get the final image

        function handleMethods(method: ConnectMethodKey, start: Vector, end: Vector) {
            if(method === 'lineTo') {
                ctx.lineTo(end.x, end.y)
            }

            if(method === 'bezierCurveTo') { //error here, try fix it with better bezier curve
                ctx.bezierCurveTo(
                    2 * start.x - end.x, 2 * start.y - end.y,
                    2 * end.x - start.x, 2 * end.y - start.y,
                    end.x, end.y
                )
            }

            if(method === 'quadraticCurveTo') {
                ctx.quadraticCurveTo(
                    (start.x + end.x) / 2, Math.max(start.y, end.y),
                    end.x, end.y
                )
            }
        }

        /**focus points id container */
        let focusedPoints: string[] = []

        //crop box declare
        const cropBox = new CropBox(canvas, {
            sideLength: _radius * 5,
            sideWidth: _radius,
            boxColor: '#000000'
        })
        

        //movable path declare
        const movablePath = new MovablePath(canvas, { 
            pointRadius: _radius,
            allowModify: true
        })

        //render method
        function draw(drawImage = false) {
            //init
            if(drawImage) {
                ctx.drawImage(img, width / 6, height / 6, maskCanvas.width , maskCanvas.height)
            }

            //draw shape method
            ctx.beginPath()
            ctx.moveTo(A.x, 0)

            //handle methods
            handleMethods('lineTo', new Vector(A.x, 0), A)

            handleMethods(connectMethod['AB'], A, B)
            handleMethods(connectMethod['BC'], B, C)
            handleMethods(connectMethod['CD'], C, D)
            handleMethods(connectMethod['DE'], D, E)

            handleMethods('lineTo', E, new Vector(E.x, 0))

            //handle options
            if(options.fillTopWithBubbleColor) {
                const maxY = Math.max(A.y, B.y, C.y, D.y, E.y) + _radius / 2
                ctx.fillStyle = options.bubbleColor
                ctx.fillRect(0, 0, canvas.width, maxY)
            }

            if(options.moveAllPointAtOnce) {
                if(movablePath.target !== 'select') {
                    movablePath.target = 'select'
                    movablePath.selectAll()
                }
            } else{
                if(movablePath.target === 'select'){
                    movablePath.target = 'single'
                    movablePath.deselectAll()
                }
            }

            ctx.strokeStyle = options.strokeColor
            ctx.lineWidth = options.lineWidth
            ctx.stroke()

            ctx.fillStyle = options.bubbleColor
            ctx.fill()

            //handle points
            if(!drawImage && options.displayPointsAsDots) {
                ;[A, B, C, D, E].forEach(v => v.dot(ctx, {
                    radius: _radius,
                    color: focusedPoints.includes(v.id) ? 'yellow' : 'red'
                }))
            }

            //cropbox handle
            cropBox.enableCrop = options.enableCrop

            if(!drawImage) {
                cropBox.draw()
            }
        }

        draw()

        function render(drawImage = false) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            draw(drawImage)
        }

        movablePath.render = render

        movablePath.target = 'select'

        movablePath.addPoints(A,B,C,D,E)

        movablePath.onPointFocusedChange = (record) => {
            focusedPoints = Object.keys(record)
        }

        movablePath.selectAll()

        function setOptions(propsToModify: Partial<typeof options>) {
            Object.assign(options, propsToModify)

            render()
        }

        /**from cctext to text with white space */
        function camelCaseToText(cctext: string) {
            return cctext.split('').map(c => c === c.toUpperCase() ? ' ' + c.toLowerCase() : c).join('')
        }

        //add advance edit here
        const advanceSettingsContainer = document.getElementById('advanceSetting') as HTMLDivElement

        function isColor(value: string) {
            return /^#[0-9A-Fa-f]{6}$/.test(value)
        }

        Object.entries(options).forEach(([key, value]) => {

            const div = document.createElement('div')

            Object.assign(div.style, {
                position: 'relative',
                display: 'flex',
                flexDirection: 'row',
                marginBottom: '5px'
            } as CSSStyleDeclaration)

            const input = document.createElement('input')
        
            input.style.border = '2px dashed rgba(256, 256, 256, 0.5)'

            const p = document.createElement('p')

            p.innerText = camelCaseToText(key)

            p.style.paddingLeft = p.style.paddingRight = '5px'

            advanceSettingsContainer.append(div)

            div.append(p, input)

            if(typeof value === 'boolean') {
                input.type = 'checkbox'

                input.checked = value

                input.addEventListener('change', () => {
                    setOptions({[key]: input.checked})
                })
            } else if(typeof value === 'string') {
                input.type = isColor(value) ? 'color' : 'text'

                input.value = value

                input.addEventListener('input', () => {
                    setOptions({[key]: input.value})
                })
            } else if(typeof value === 'number'){
                input.type = 'number'

                input.value = value + ''

                input.addEventListener('input', () => {
                    setOptions({[key]: input.valueAsNumber})
                })
            }
        })

        //get result image
        const getResultButton = document.getElementById('get-result-button') as HTMLButtonElement
        const resultDisplay = document.getElementById('result-display') as HTMLDivElement

        getResultButton.addEventListener('click', () => {
            //draw actual image
            render(true)

            //get image url
            const base64img = cropBox.getCroppedImageUrl()

            //clear prev result
            resultDisplay.innerHTML = ''

            const div = document.createElement('div')
            div.className = ' relative w-full h-fit flex flex-col '

            const img = document.createElement('img')
            img.className = 'relative w-4/5 h-auto pt-5 self-center'
            img.alt = 'bubble image'
            img.src = base64img

            const downloadA = document.createElement('a')
            downloadA.href = base64img
            downloadA.download = "my-bubble-meme"

            const downloadDiv = document.createElement('div')
            downloadDiv.className = 'relative w-fit h-auto mt-5 self-start bg-blue-500 text-center border-2 mb-20'
            downloadDiv.innerText = "download image"
            downloadDiv.addEventListener('click', () => {
                downloadA.click()
            })

            div.append(img)

            resultDisplay.append(div, downloadDiv)

            //re render
            render()
        })
    }
}