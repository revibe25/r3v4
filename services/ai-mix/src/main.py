from ai_mix import auto_mix, auto_master

@app.post("/mix")
async def mix(file: UploadFile):
    path = "/tmp/in.wav"
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"file": auto_mix(path)}

@app.post("/master")
async def master(file: UploadFile):
    path = "/tmp/in.wav"
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"file": auto_master(path)}