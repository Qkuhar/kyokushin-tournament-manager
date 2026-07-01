import {store} from './state/store.js';
console.log('App started',store);

import { renderParticipants } from "./views/participantsView.js";

const content=document.getElementById("content");

renderParticipants(content);