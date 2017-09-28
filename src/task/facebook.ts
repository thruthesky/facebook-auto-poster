import { MyNightmare as Nightmare } from './../nightmare/nightmare';
import { MyFileSystem as myFs } from '../file-system';
import * as path from 'path';

let defaultOptions = {
    show: true, x: 1024, y: 0, width: 640, height: 400,
    openDevTools: { mode: 'detach' },
};

let nightmare = new Nightmare(defaultOptions);
nightmare.firefox();

let fs = new myFs();
class Facebook{
    rootUrl = 'https://m.facebook.com/'

    id = nightmare.argv.id;
    password = nightmare.argv.password;

    loginButton = 'input[name="login"]';
    usernameField = 'input[name="email"]';
    passwordField = 'input[name="pass"]';
    
    //facebook posting variables
    wallTextArea = 'textarea[name="xc_message"]';
    postButton = 'input[name="view_post"]';
    groupPostWarn = `a:contains('${"1 post requiring approval"}')`
    stringToPost = fs.getText( path.join( __dirname, "../../src/facebook-setting/", "facebook-post.txt" ) );
    groupsUrl = fs.getList( path.join(__dirname ,"../../src/facebook-setting/", "facebook-group-list.txt") );
}


let facebook = new Facebook;

run( facebook );


/**
 * run -> login -> post on wall -> 1 (jump to group url -> post) -> repeat 1 until all fb group have
 */
async function run( facebook : Facebook ) {

    await login( facebook );
    await nightmare.get( facebook.rootUrl + 'profile.php' );
    await postAd( facebook );
    for ( let group of facebook.groupsUrl ) {
        await postInGroup( facebook, group );
    }

    await nightmare._exit("Task finished.");
}

/**
 * Posts in each group that is listed in the text file.
 */
async function postInGroup( facebook : Facebook, groupUrl: string ) {

    await nightmare.nextAction("Goto group: " + groupUrl)
    let $html = await nightmare.get( groupUrl )

    await nightmare.nextAction("Checking for selector: " + facebook.wallTextArea)
    let canPost = await nightmare.waitAppear(facebook.wallTextArea, 5)
    if ( await canPost ) {
        await nightmare.nextAction("Checking for pending post.")
        let isPostPending = await nightmare.waitAppear(facebook.groupPostWarn, 5);
            (!isPostPending)? await postAd( facebook )
                            : await nightmare.success("There is pending post")
    }else{
        await nightmare.failure("Text area is missing.");
    } 
}



/**
 * Function that will do posting, works on facebook profile wall.
 * @param textAreaToWriteTo - element where we can write the stingPost
 * @param stringToPost - string to write in the post.
 * @param submitButton - submit button to click.
 *  - String that will be posted. 
 */
async function postAd( facebook : Facebook ) {
    let postReference = await nightmare.generatePostId;
    // await nightmare.waitTest(facebook.wallTextArea,'Looking for posting text area to write to.');
    await nightmare.nextAction('Typing the post.');
    await nightmare.type( facebook.wallTextArea, facebook.stringToPost + postReference )
                    .click( facebook.postButton );
    let isPending = await nightmare.waitAppear( facebook.groupPostWarn, 5 )
    
    if ( isPending ){
        await nightmare.success('Post pending.')
    }
    else{
        let isPosted = await findPost( postReference );
        ( isPosted ) ? await nightmare.success("Post found.")
                     : await nightmare.failure("Post not found.");
        }
}

async function checkPostPending() {
    let re;
    let isPostPending = await nightmare.waitAppear(facebook.groupPostWarn, 5);
    (isPostPending)? await nightmare.success("Post pending.")
                    : await nightmare.failure("Post success.");
    return re
}

/**
 * on parameter id use facebook username.
 * @param id 
 * @param password 
 */
async function login( facebook : Facebook ){

    let $html = await nightmare.get(facebook.rootUrl);
    
    await nightmare.nextAction('Typing email and password.');
    await nightmare.type(facebook.usernameField, facebook.id);
    await nightmare.type(facebook.passwordField, facebook.password);
    await nightmare.nextAction('Press enter to login.');
    await nightmare.enter(facebook.passwordField);

    // await nightmare.wait(100);

    let re = await nightmare.waitDisappear( facebook.passwordField );
    await ( re )?  nightmare.success("You are NOT in login page")
                :  nightmare.failure("You are STILL in login page");
    await nightmare.wait( 'body' );
}

/**
 * Checks if a post exists in a span.
 * @param query - string to find 
 */
async function findPost( query: string ){
    await nightmare.nextAction('Checking post if success!')
    let selector = await `span:contains('${query}')`; //cannot use for wait()
    let $html = await nightmare.getHtml();
    let re = await nightmare.waitAppear(selector);

    return await re;
}