export interface WorldPoint {x:number;y:number}
/** Circle against an oriented rectangle, independent of visual sprite size. */
export function circleTouchesStrip(point:WorldPoint,radius:number,center:WorldPoint,angle:number,length:number,width:number):boolean {
 const dx=point.x-center.x,dy=point.y-center.y,c=Math.cos(angle),s=Math.sin(angle);
 const x=Math.max(0,Math.abs(dx*c+dy*s)-length/2),y=Math.max(0,Math.abs(-dx*s+dy*c)-width/2);
 return x*x+y*y<=radius*radius;
}
export function segmentIntersection(a:WorldPoint,b:WorldPoint,c:WorldPoint,d:WorldPoint):WorldPoint|undefined {
 const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,cross=ux*vy-uy*vx;
 if(Math.abs(cross)<1e-8)return;
 const dx=c.x-a.x,dy=c.y-a.y,t=(dx*vy-dy*vx)/cross,u=(dx*uy-dy*ux)/cross;
 if(t<-1e-8||t>1+1e-8||u<-1e-8||u>1+1e-8)return;
 return{x:a.x+t*ux,y:a.y+t*uy};
}
