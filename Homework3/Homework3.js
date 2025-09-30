import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

// Global variables
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change
let shader;
let vao;
let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let isCircleDrawing = false; // mouse button을 누르고 있는 동안 true로 change
let isLineDrawing = false;
let startPoint = null;  // mouse button을 누른 위치
let tempEndPoint = null; // mouse를 움직이는 동안의 위치
let tempRadius = null;
let circles = [];
let lines = []; // 그려진 선분들을 저장하는 array
let intersection = [];
let textOverlay; // 1st line segment 정보 표시
let textOverlay2;
let textOverlay3;
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)

// DOMContentLoaded event
// 1) 모든 HTML 문서가 완전히 load되고 parsing된 후 발생
// 2) 모든 resource (images, css, js 등) 가 완전히 load된 후 발생
// 3) 모든 DOM 요소가 생성된 후 발생
// DOM: Document Object Model로 HTML의 tree 구조로 표현되는 object model 
// 모든 code를 이 listener 안에 넣는 것은 mouse click event를 원활하게 처리하기 위해서임
// mouse input을 사용할 때 이와 같이 main을 call 한다. 

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;

    resizeAspectRatio(gl, canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
        -((y / canvas.height) * 2 - 1) // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
    ];
}

/* 
    browser window
    +----------------------------------------+
    | toolbar, address bar, etc.             |
    +----------------------------------------+
    | browser viewport (컨텐츠 표시 영역)       | 
    | +------------------------------------+ |
    | |                                    | |
    | |    canvas                          | |
    | |    +----------------+              | |
    | |    |                |              | |
    | |    |      *         |              | |
    | |    |                |              | |
    | |    +----------------+              | |
    | |                                    | |
    | +------------------------------------+ |
    +----------------------------------------+

    *: mouse click position

    event.clientX = browser viewport 왼쪽 경계에서 마우스 클릭 위치까지의 거리
    event.clientY = browser viewport 상단 경계에서 마우스 클릭 위치까지의 거리
    rect.left = browser viewport 왼쪽 경계에서 canvas 왼쪽 경계까지의 거리
    rect.top = browser viewport 상단 경계에서 canvas 상단 경계까지의 거리

    x = event.clientX - rect.left  // canvas 내에서의 클릭 x 좌표
    y = event.clientY - rect.top   // canvas 내에서의 클릭 y 좌표
*/

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표
        
        if (!(isCircleDrawing||isLineDrawing) && (lines.length < 1 || circles.length < 1)) { 
            // 1번 또는 2번 선분을 그리고 있는 도중이 아닌 경우 (즉, mouse down 상태가 아닌 경우)
            // 캔버스 좌표를 WebGL 좌표로 변환하여 선분의 시작점을 설정
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            startPoint = [glX, glY];
            isCircleDrawing = true; // 이제 mouse button을 놓을 때까지 계속 true로 둠. 즉, mouse down 상태가 됨
            if (circles.length == 1) {
                isLineDrawing = true;
                isCircleDrawing = false;
            }
        }
    }

    function handleMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        let [glX, glY] = convertToWebGLCoordinates(x, y);

        if (isCircleDrawing) { // 1번 원을 그리고 있는 도중인 경우
            tempEndPoint = [glX, glY]; // 임시 선분의 끝 point

            if (startPoint) {
                const dx = glX - startPoint[0];
                const dy = glY - startPoint[1];
                tempRadius = Math.hypot(dx, dy);
            }

            render();
        }
        if (isLineDrawing) { // 2번 선분을 그리고 있는 도중인 경우
            tempEndPoint = [glX, glY]; // 임시 선분의 끝 point
            render();
        } 
    }

    function handleMouseUp() {
        if (isCircleDrawing && tempEndPoint) {

            // calculate radius
            const dx = tempEndPoint[0] - startPoint[0];
            const dy = tempEndPoint[1] - startPoint[1];
            const r = Math.hypot(dx, dy);

            circles.push([startPoint[0], startPoint[1], r]); 

            
            updateText(textOverlay, "Circle: center (" + circles[0][0].toFixed(2) + ", " + circles[0][1].toFixed(2) + 
                ") radius = " + circles[0][2].toFixed(2));            
            

            isCircleDrawing = false;
        }

        else if (isLineDrawing && tempEndPoint) {

            lines.push([...startPoint, ...tempEndPoint]);
            
            updateText(textOverlay2, "Line segment: (" + lines[0][0].toFixed(2) + ", " + lines[0][1].toFixed(2) + 
                ") ~ (" + lines[0][2].toFixed(2) + ", " + lines[0][3].toFixed(2) + ")\n");
            
            isLineDrawing = false;
        }

        startPoint = null;
        tempEndPoint = null;
        render();
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function circlesVertices(cx, cy, r, segments = 96) {
  const verts = new Float32Array(segments * 2);
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2.0;
    verts[i * 2]     = cx + r * Math.cos(t);
    verts[i * 2 + 1] = cy + r * Math.sin(t);
  }
  return verts;
}

function calculateIntersection() {

    let intersection = new Float32Array(8);

    // Let x(t) = at + b, y(t) = ct + d
    // lines[0] = {x1, y1, x2, y2}
    let a, b, c, d, e, f, r;
    a = lines[0][2] - lines[0][0];      // a = x2 - x1
    b = lines[0][0];                    // b = x1
    c = lines[0][3] - lines[0][1];      // c = y2 - y1
    d = lines[0][1];                    // d = y1
    e = circles[0][0];
    f = circles[0][1];
    r = circles[0][2];

    let A, B, C, D;
    A = a*a + c*c;
    B = 2*(a*b - a*e + c*d - c*f);
    C = b*b + d*d + e*e + f*f - r*r - 2*(b*e + d*f);
    D = B*B - 4*A*C;

    // t1, t2 is solution of At^2+Bt+C = 0
    let t1, t2;
    let sqrtD = Math.sqrt(D);

    if (D > 0) {
        // distinct t1, t2 is real

        t1 = (-B + sqrtD) / (2*A);
        t2 = (-B - sqrtD) / (2*A);

        if ((t1 < 0 || t1 > 1) && (t2 < 0 || t2 > 1)) {
            // both t1 and t2 are out of line segment
            intersection[0] = 0;
        } 
        else if ((t1 < 0 || t1 > 1)) {
            // t1 is out of line segment and t2 is in line segment
            intersection[0] = 1;

            intersection[1] = a * t2 + b;
            intersection[2] = c * t2 + d;

        }
        else if ((t2 < 0 || t2 > 1)) {
            // t2 is out of line segment and t1 is in line segment
            intersection[0] = 1

            intersection[1] = a * t1 + b;
            intersection[2] = c * t1 + d;

        }
        else {
            // both t1 and t2 are in line segment
            intersection[0] = 2;

            intersection[1] = a * t1 + b;
            intersection[2] = c * t1 + d;

            intersection[3] = a * t2 + b;
            intersection[4] = c * t2 + d;
        }
    }
    else if (Math.abs(D) < 0.000001) {
        // same t1, t2 is real

        t1 = (-B) / (2*A);

        intersection[0] = 1;

        intersection[1] = a * t1 + b;
        intersection[2] = c * t1 + d;

    }
    // t1, t2 is imaginary
    else if (D < 0) intersection[0] = 0;

    return intersection;

}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    shader.use();

    let num = 0;


    // 저장된 원들 그리기
    for (let [cx, cy, r] of circles) {
        shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);

        const verts = circlesVertices(cx, cy, r);

        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_LOOP, 0, verts.length / 2);
        num++;
    }

    // 임시 원 그리기
    if (isCircleDrawing && startPoint && tempEndPoint) {

        const dx = tempEndPoint[0] - startPoint[0];
        const dy = tempEndPoint[1] - startPoint[1];
        const r = Math.hypot(dx, dy);

        shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색
        const verts = circlesVertices(startPoint[0], startPoint[1], r);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_LOOP, 0, verts.length / 2);
    }

    // 저장된 선들 그리기
    for (let line of lines) {
        shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
        num++;
    }

    // 임시 선 그리기
    if (isLineDrawing && startPoint && tempEndPoint) {
        shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempEndPoint]), 
                      gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // calculate and render intersection
    if (circles.length == 1 && lines.length == 1) {

        intersection = calculateIntersection();

        const pts = [];

        if (intersection[0] == 2) {
            updateText(textOverlay3, "Intersection Points: 2 Point 1: (" + intersection[1].toFixed(2) + ", " + 
                intersection[2].toFixed(2) + ") Point 2: (" + intersection[3].toFixed(2) + ", " + intersection[4].toFixed(2) + ")");

            pts.push(intersection[1], intersection[2], intersection[3], intersection[4]);

        }
        else if (intersection[0] == 1) {
            updateText(textOverlay3, "Intersection Points: 1 Point 1: (" + intersection[1].toFixed(2) + ", " + 
                intersection[2].toFixed(2) + ")");

            pts.push(intersection[1], intersection[2]);
        }
        else if (intersection[0] == 0) {
            updateText(textOverlay3, "No intersection");
        }

        shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, pts.length / 2);
    }

    // axes 그리기
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달

}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();

        // 텍스트 초기화
        textOverlay = setupText(canvas, "", 1);
        textOverlay2 = setupText(canvas, "", 2);
        textOverlay3 = setupText(canvas, "", 3);
        
        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
