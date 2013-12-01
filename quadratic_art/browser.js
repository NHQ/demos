var touchdown = require('touchdown')
var envelope = require('./deCasteljau');
var Context = document.getElementById('context');
var context = window.context = Context.getContext('2d');

var w = Context.width = window.innerWidth
var h = Context.height = window.innerHeight
touchdown.start(Context)

Context.addEventListener('deltavector', function(evt){
    drawCurve(evt.detail.x, evt.detail.y)
})

drawCurve(w/2, h/3+100)

function drawCurve(x,y){
    var r = Math.round(Math.abs((w/2) - x))
    var g = Math.round(Math.abs(255 - distance([w/2,h/2],[x,y])))
    var b = Math.round(Math.abs((h/2) - y))
    context.fillStyle = 'rgba(100,66,100,255)'
//    context.strokeRect(w/2 -100,h/3,200,200)
    context.beginPath();
    context.lineWidth = 3
    context.moveTo(w/2-100, h/3 + 200)
    context.quadraticCurveTo(x,y,w/2 + 100,h/3)
    context.strokeStyle = ['rgba(',r,',',g,',',b,',',157,')'].join('')
    context.stroke()
    console.log(['rgba(',r,',',g,',',b,',',255,')'].join(''))
}

function distance(p1, p2){
        return Math.sqrt(
                Math.pow(p2[0] - p1[0], 2) +
                Math.pow(p2[1] - p1[1], 2)
        )
};
