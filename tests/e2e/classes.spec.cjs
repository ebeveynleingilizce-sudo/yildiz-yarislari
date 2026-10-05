const {test,expect,loginTeacher}=require('./fixtures.cjs');
async function rename(page,name){await page.locator('#renameClass').click();await page.locator('#classNameInput').fill(name);await page.locator('#classDialogSave').click();await expect(page.locator('#classNameLabel')).not.toBeVisible();}
async function create(page,name){await page.locator('#createClass').click();await page.locator('#classNameInput').fill(name);await page.locator('#classDialogSave').click();await expect(page.locator('#classDialogSave')).not.toBeVisible();return page.locator('#classSelect').inputValue();}
test('tunc@test.com: 5/A and 6/B isolate students, codes, progress, moves and another teacher',async({page,context})=>{
 test.setTimeout(90000);
 await page.goto('/?teacher=1');await page.waitForFunction(()=>window.__testCloud?.ready);
 await page.locator('#firebaseTeacherEmail').fill('tunc@test.com');await page.locator('#firebaseTeacherPassword').fill('test-only-password');await page.locator('#firebaseLoginSubmit').click();
 await expect(page.locator('#firebaseLoginOverlay')).not.toHaveClass(/open/);await page.locator('#settingsBtn').click();
 await expect(page.locator('#classSelect')).toContainText('Varsayılan Sınıf');
 const defaultId=await page.locator('#classSelect').inputValue();
 await rename(page,'5/A');
 for(const [id,name] of [['1','Ahmet'],['2','Mehmet']]){await page.locator('[data-name="'+id+'"]').fill(name);await page.locator('[data-name="'+id+'"]').press('Tab');}
 await expect(page.locator('#lanes')).toContainText('Ahmet');
 await expect.poll(()=>page.evaluate(()=>window.__testCloud.data().teacherData['teacher-a'].students.map(s=>s.name).join(','))).toBe('Ahmet,Mehmet');
 const ahmetCode=await page.evaluate(()=>{const data=window.__testCloud.data().teacherData['teacher-a'];return window.raceCloud.getStudentConnectionCode('1',data.studentAccessCodes['1']);});
 const classB=await create(page,'6/B');
 await expect(page.locator('.student-card')).toHaveCount(0);
 for(const name of ['Ayşe','Zeynep']){
  await page.locator('#addStudent').click();const input=page.locator('[data-name]').last();await input.fill(name);await input.press('Tab');
 }
 await expect(page.locator('#lanes')).toContainText('Ayşe');await expect(page.locator('#lanes')).not.toContainText('Ahmet');
 await page.locator('#classSelect').selectOption(defaultId);await expect(page.locator('.student-card')).toHaveCount(2);
 await expect(page.locator('#lanes')).toContainText('Mehmet');await expect(page.locator('#lanes')).not.toContainText('Zeynep');
 await expect(page.locator('#studentControls')).toContainText('Sınıf: 5/A');
 const student=await context.newPage();await student.goto('/');await student.waitForFunction(()=>window.__testCloud?.ready);await student.locator('#studentAccessCode').fill(ahmetCode);await student.locator('#studentAccessSubmit').click();
 await expect(student.locator('#raceApp')).toBeVisible();await expect(student.locator('#lanes')).toContainText('Ahmet');await expect(student.locator('#lanes')).not.toContainText('Ayşe');
 const denied=await student.evaluate(async token=>{try{await window.__firebaseSdk.get(window.__firebaseSdk.ref(null,'sharedRosters/'+token));return false}catch(e){return e.code==='PERMISSION_DENIED'}},await page.evaluate(id=>window.__testCloud.data().teacherData['teacher-a'].classes[id].shareToken,classB));
 expect(denied).toBe(true);
 await page.evaluate(()=>window.raceCloud.logout());await loginTeacher(page,'b');await rename(page,'5/A');
 await expect(page.locator('#lanes')).toContainText('Öğretmen B');await expect(page.locator('#lanes')).not.toContainText('Ahmet');
 await loginTeacher(page,'a');await page.locator('#classSelect').selectOption(defaultId);
 await page.locator('[data-move-student="1"]').click();await page.locator('#classTarget').selectOption(classB);await page.locator('#classDialogSave').click();
 await expect(page.locator('#lanes')).not.toContainText('Ahmet');await expect(student.locator('#raceApp')).toBeHidden();
 await page.locator('#classSelect').selectOption(classB);await expect(page.locator('#lanes')).toContainText('Ahmet');
 await page.locator('#deleteClass').click();await page.locator('#classTarget').selectOption(defaultId);await page.locator('#classDialogSave').click();
 await expect(page.locator('#classSelect option')).toHaveCount(1);await expect(page.locator('.student-card')).toHaveCount(4);
 await expect(page.locator('#lanes')).toContainText('Zeynep');await expect(page.locator('#lanes')).toContainText('Mehmet');
 await student.close();
});
