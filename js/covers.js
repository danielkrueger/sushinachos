// Cover art is rendered using the same artwork as the playable games.
document.querySelectorAll('[data-cover]').forEach(canvas => {
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    if(canvas.dataset.cover==='runner') {
        const game=new PizzaRunnerGame(canvas,w,h,()=>{});game.cover=true;
        game.distance=28;
        game.objects=[{lane:0,z:10,kind:'cactus'},{lane:2,z:22,kind:'barrier'},...Array.from({length:6},(_,i)=>({lane:1,z:8+i*5,kind:'coin'}))];
        game.render();
    } else {
        JohnArt.kitchen(ctx,w,h,canvas.dataset.cover==='ninja',0,false);
        if(canvas.dataset.cover==='catcher') JohnArt.john(ctx,w*.48,h*.95,1.7);
        for(let i=0;i<5;i++)JohnArt.food(ctx,['burrito','sushi','taco','sashimi','special'][i],85+i*116,130+(i%2)*55,68,i*.6);
    }
});
