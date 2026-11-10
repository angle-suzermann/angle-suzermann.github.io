/* Student entrances use the existing cards; no duplicate assignments or submissions. */
(()=>{'use strict';const course=document.body.dataset.homeworkCourse;if(!course)return;
const name=document.getElementById('studentName'),heading=document.getElementById('studentHeading'),select=document.getElementById('lessonSelect'),button=document.getElementById('openLesson'),status=document.getElementById('nameStatus'),parts=document.getElementById('lessonParts');let cards=[];
const nameKey='angle.studentName.'+course,lessonKey='angle.homeworkHub.lesson.'+course;
try{name.value=localStorage.getItem(nameKey)||'';}catch(_){}
function updateName(){heading.textContent=name.value.trim()?'Homework submissions — '+name.value.trim():'Homework submissions';try{localStorage.setItem(nameKey,name.value.trim());}catch(_){}status.textContent='';}
name.addEventListener('input',updateName);updateName();window.AngleStudentPicker?.mount({input:name,courseId:course});
const date=iso=>new Date(iso+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
function selectLesson(){const c=cards.find(c=>c.id===select.value);parts.replaceChildren();if(!c)return;for(const part of c.parts){const li=document.createElement('li');li.textContent=part.label;parts.append(li);}try{localStorage.setItem(lessonKey,c.id);}catch(_){}document.getElementById('lessonDue').textContent=c.due?'Сдать до '+date(c.due):'';}
select.addEventListener('change',selectLesson);
button.onclick=()=>{if(!name.value.trim()){status.textContent='Укажи имя ученика.';name.focus();return;}const c=cards.find(c=>c.id===select.value);if(c)location.assign(c.path.replace(/ /g,'%20'));};
fetch('/assets/homework-cards.json?v=1').then(r=>{if(!r.ok)throw Error();return r.json();}).then(all=>{cards=all.filter(c=>c.courseId===course&&c.path.startsWith('/'+course+'/')).sort((a,b)=>b.lesson.localeCompare(a.lesson));select.replaceChildren();for(const c of cards){const o=document.createElement('option');o.value=c.id;o.textContent=date(c.lesson)+(c.due?' → '+date(c.due):'')+' · '+c.title.replace(/^\d+\.\s*/,'');select.append(o);}let saved='';try{saved=localStorage.getItem(lessonKey)||'';}catch(_){}if(cards.some(c=>c.id===saved))select.value=saved;button.disabled=!cards.length;select.disabled=!cards.length;selectLesson();if(!cards.length)status.textContent='Для этой группы пока нет карточек домашней работы.';}).catch(()=>{status.textContent='Не удалось загрузить список уроков. Обнови страницу или открой материалы группы по ссылке ниже.';});
})();
