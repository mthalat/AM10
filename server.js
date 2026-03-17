
const express = require("express");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const app = express();

app.use(express.json({limit:"10mb"}));
app.use(express.static(path.join(__dirname, "public")));

const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ----- IMAGE SCAN -----
app.post("/api/fridge/scan", async (req,res)=>{
  try{
    const image = req.body.image;
    if(!image) return res.json({error:"No image"});

    const base64 = image.split(",")[1];

    const prompt = `
    Look at this fridge image and return ONLY a JSON array of ingredients you see.
    Example:
    ["tomato","cucumber","cheese"]
    `;

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+GEMINI_KEY,
      {
        method:"POST",
        headers:{ "Content-Type":"application/json"},
        body: JSON.stringify({
          contents:[{
            parts:[
              {text:prompt},
              {
                inline_data:{
                  mime_type:"image/jpeg",
                  data:base64
                }
              }
            ]
          }]
        })
      }
    );

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    let ingredients=[];
    try{
      ingredients = JSON.parse(text);
    }catch{
      ingredients = text.replace(/[\[\]]/g,"").split(",").map(x=>x.trim()).filter(Boolean);
    }

    res.json({ingredients});
  }catch(e){
    res.json({error:e.message});
  }
});

// ----- RECIPES -----
app.post("/api/fridge/recipes", async (req,res)=>{
  try{
    const ingredients = req.body.ingredients || [];

    const prompt = `
    Create 3 cooking recipes using these ingredients:
    ${ingredients.join(", ")}

    Return JSON in this format:
    {
      "recipes":[
        {
          "title":"recipe name",
          "ingredients":["item1","item2"],
          "steps":["step1","step2"]
        }
      ]
    }
    `;

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+GEMINI_KEY,
      {
        method:"POST",
        headers:{ "Content-Type":"application/json"},
        body: JSON.stringify({
          contents:[{parts:[{text:prompt}]}]
        })
      }
    );

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let json;
    try{
      json = JSON.parse(text);
    }catch{
      json = {recipes:[]};
    }

    res.json(json);
  }catch(e){
    res.json({error:e.message});
  }
});

// fallback
app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log("Server running on port "+PORT);
});
