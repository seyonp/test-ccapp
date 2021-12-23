// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as React from 'react';
import { PropTypes } from 'react';
import {merge} from 'lodash';
import {SimpleMarkdownEditor} from 'react-simple-markdown-editor';
// import MarkdownIt from 'markdown-it';
// import MdEditor from 'react-markdown-editor-lite';
// import { Guid } from "guid-typescript";
// import 'react-markdown-editor-lite/lib/index.css';
import { RouteComponentProps } from 'react-router-dom';
import { withTranslation, WithTranslation } from "react-i18next";
// import { initializeIcons } from 'office-ui-fabric-react/lib/Icons';
import * as AdaptiveCards from "adaptivecards";
import { Button, Loader, Dropdown, Text, Flex, Input, TextArea, RadioGroup, Checkbox, Datepicker } from '@fluentui/react-northstar'
// line in cristianoag only:
import { TrashCanIcon, AddIcon, FilesUploadIcon } from '@fluentui/react-icons-northstar'
import * as microsoftTeams from "@microsoft/teams-js";
import Resizer from 'react-image-file-resizer';
// line in cristianoag only:
import Papa from "papaparse";
import './newMessage.scss';
import './teamTheme.scss';
import { getDraftNotification, getTeams, createDraftNotification, updateDraftNotification, searchGroups, getGroups, verifyGroupAccess } from '../../apis/messageListApi';
// setCardBtn (not setCardBtns)
import { getInitAdaptiveCard, setCardTitle, setCardImageLink, setCardSummary, setCardAuthor, setCardBtns } from '../AdaptiveCard/adaptiveCard';
import { getBaseUrl } from '../../configVariables';
import { ImageUtil } from '../../utility/imageutility';
import { TFunction } from "i18next";


//hours to be chosen when scheduling messages
const hours = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
    "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23",
];

//minutes to be chosen when scheduling messages
const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
];

//coeficient to round dates to the next 5 minutes
const coeff = 1000 * 60 * 5;

type dropdownItem = {
    key: string,
    header: string,
    content: string,
    image: string,
    team: {
        id: string,
    },
}

export interface IDraftMessage {
    id?: string,
    title: string,
    imageLink?: string,
    summary?: string, // not any?
    author: string,
    buttonTitle?: string,
    buttonLink?: string,
    teams: any[],
    rosters: any[],
    groups: any[],
    csvusers: string, // line in cristianoag only
    allUsers: boolean,
    isImportant: boolean, // indicates if the message is important -- line in cristianoag only
    isScheduled: boolean, // indicates if the message is scheduled
    ScheduledDate: Date, // stores the scheduled date
    Buttons: string // stores tha card buttons (JSON) -- line in cristianoag only
}

export interface formState {
    title: string,
    summary?: string,
    // summary?: any,
    btnLink?: string,
    imageLink?: string,
    btnTitle?: string,
    author: string,
    card?: any,
    page: string,
    teamsOptionSelected: boolean,
    rostersOptionSelected: boolean,
    allUsersOptionSelected: boolean,
    groupsOptionSelected: boolean,
    csvOptionSelected: boolean, // line in cristianoag only
    csvLoaded: string, // line in cristianoag only
    csvError: boolean, // line in cristianoag only
    csvusers: string, // line in cristianoag only
    teams?: any[],
    groups?: any[],
    exists?: boolean,
    messageId: string,
    loader: boolean,
    groupAccess: boolean,
    loading: boolean,
    noResultMessage: string,
    unstablePinned?: boolean,
    selectedTeamsNum: number,
    selectedRostersNum: number,
    selectedGroupsNum: number,
    selectedRadioBtn: string,
    selectedTeams: dropdownItem[],
    selectedRosters: dropdownItem[],
    selectedGroups: dropdownItem[],
    errorImageUrlMessage: string,
    errorButtonUrlMessage: string,
    selectedSchedule: boolean, //status of the scheduler checkbox
    selectedImportant: boolean, //status of the importance selection on the interface -- line in cristianoag only
    scheduledDate: string, //stores the scheduled date in string format
    DMY: Date, //scheduled date in date format 
    DMYHour: string, //hour selected
    DMYMins: string, //mins selected
    futuredate: boolean, //if the date is in the future (valid schedule)
    values: any[] //button values collection -- line in cristianoag only
}

export interface INewMessageProps extends RouteComponentProps, WithTranslation {
    getDraftMessagesList?: any;
}

class NewMessage extends React.Component<INewMessageProps, formState> {
    readonly localize: TFunction;
    private card: any;
    fileInput: any;
    CSVfileInput: any; // line in cristianoag only

    constructor(props: INewMessageProps) {
        super(props);
        // initializeIcons();
        this.localize = this.props.t;
        this.card = getInitAdaptiveCard(this.localize);
        this.setDefaultCard(this.card);
        var TempDate = this.getRoundedDate(5,this.getDateObject()); //get the current date
        this.state = {
            title: "",
            summary: "",
            author: "",
            btnLink: "",
            imageLink: "",
            btnTitle: "",
            card: this.card,
            page: "CardCreation",
            teamsOptionSelected: true,
            rostersOptionSelected: false,
            allUsersOptionSelected: false,
            groupsOptionSelected: false,
            csvOptionSelected: false, // line in cristianoag only
            csvLoaded: "", // line in cristianoag only
            csvError: false, // line in cristianoag only
            csvusers: "", // line in cristianoag only
            messageId: "",
            loader: true,
            groupAccess: false,
            loading: false,
            noResultMessage: "",
            unstablePinned: true,
            selectedTeamsNum: 0,
            selectedRostersNum: 0,
            selectedGroupsNum: 0,
            selectedRadioBtn: "teams",
            selectedTeams: [],
            selectedRosters: [],
            selectedGroups: [],
            errorImageUrlMessage: "",
            errorButtonUrlMessage: "",
            selectedSchedule: false, //scheduler option is disabled by default
            selectedImportant: false, //important flag for the msg is false by default -- line in cristianoag only
            scheduledDate: TempDate.toUTCString(), //current date in UTC string format
            DMY: TempDate, //current date in Date format
            DMYHour: this.getDateHour(TempDate.toUTCString()), //initialize with the current hour (rounded up)
            DMYMins: this.getDateMins(TempDate.toUTCString()), //initialize with the current minute (rounded up)
            futuredate: false, //by default the date is not in the future
            values: [] // by default there are no buttons on the adaptive card -- line in cristianoag only
        }
        this.fileInput = React.createRef();
        this.CSVfileInput = React.createRef(); // line in cristianoag only
        this.handleImageSelection = this.handleImageSelection.bind(this);
        this.handleCSVSelection = this.handleCSVSelection.bind(this); // line in cristianoag only
    }

    public async componentDidMount() {
        microsoftTeams.initialize();
        //- Handle the Esc key
        document.addEventListener("keydown", this.escFunction, false);
        let params = this.props.match.params;
        this.setGroupAccess();
        this.getTeamList().then(() => {
            if ('id' in params) {
                let id = params['id'];
                this.getItem(id).then(() => {
                    const selectedTeams = this.makeDropdownItemList(this.state.selectedTeams, this.state.teams);
                    const selectedRosters = this.makeDropdownItemList(this.state.selectedRosters, this.state.teams);
                    this.setState({
                        exists: true,
                        messageId: id,
                        selectedTeams: selectedTeams,
                        selectedRosters: selectedRosters,
                        csvusers: this.state.csvusers, // line in cristianoag only
                        selectedSchedule: this.state.selectedSchedule,
                        selectedImportant: this.state.selectedImportant, // line in cristianoag only
                        scheduledDate: this.state.scheduledDate,
                        DMY: this.getDateObject(this.state.scheduledDate),
                        DMYHour: this.getDateHour(this.state.scheduledDate),
                        DMYMins: this.getDateMins(this.state.scheduledDate),
                        values: this.state.values // line in cristianoag only
                    })
                });
                this.getGroupData(id).then(() => {
                    const selectedGroups = this.makeDropdownItems(this.state.groups);
                    this.setState({
                        selectedGroups: selectedGroups
                    })
                });
            } else {
                this.setState({
                    exists: false,
                    loader: false
                }, () => {
                    let adaptiveCard = new AdaptiveCards.AdaptiveCard();
                    adaptiveCard.parse(this.state.card);
                    let renderedCard = adaptiveCard.render();
                    document.getElementsByClassName('adaptiveCardContainer')[0].appendChild(renderedCard);
                    if (this.state.btnLink) {
                        let link = this.state.btnLink;
                        adaptiveCard.onExecuteAction = function (action) { window.open(link, '_blank'); };
                    }
                })
            }
        });
    }

    //function to handle the selection of the OS file upload box
    private handleImageSelection() {
        //get the first file selected
        const file = this.fileInput.current.files[0];
        if (file) { //if we have a file
            //resize the image to fit in the adaptivecard
            var cardsize = JSON.stringify(this.card).length; // line in cristianoag only
            Resizer.imageFileResizer(file, 400, 400, 'JPEG', 80, 0,
                uri => {
                    if (uri.toString().length < 32768) {
                        //everything is ok with the image, lets set it on the card and update
                        setCardImageLink(this.card, uri.toString());
                        this.updateCard();
                        //lets set the state with the image value
                        this.setState({
                            imageLink: uri.toString()
                        }
                        );
                    } else {
                        var errormsg = this.localize("ErrorImageTooBig") + " " + this.localize("ErrorImageTooBigSize") + " " + (32768 - cardsize) + " bytes.";
                        //images bigger than 32K cannot be saved, set the error message to be presented
                        this.setState({
                            errorImageUrlMessage: errormsg
                        });
                    }

                },
                'base64'); //we need the image in base64
        }
    }

    //Function to handle the CSV File selection -- funciton in cristianoag only
    private handleCSVSelection() {
        //get the first file selected
        const file = this.CSVfileInput.current.files[0];
        //if we have a file
        if (file) {
            //parses the CSV file using papa parse library
            Papa.parse(file, {
                complete: ({ errors, data }) => {
                    if (errors.length > 0) {
                        //file is invalid, show the message for the user
                        this.setState({
                            csvLoaded: this.localize("CSVInvalid"),
                            csvError: true,
                            csvusers: ""
                        });
                    } else {
                        //file loaded
                        this.setState({
                            csvLoaded: this.localize("CSVLoaded"),
                            csvError: false,
                            csvusers: JSON.stringify(data)
                        });
                    }
                }
            });

        }
    }

    //Function calling a click event on a hidden file input
    private handleUploadClick = (event: any) => {
        //reset the error message and the image link as the upload will reset them potentially
        this.setState({
            errorImageUrlMessage: "",
            imageLink: ""
        });
        //fire the fileinput click event and run the handleimageselection function
        this.fileInput.current.click();
    };

    //Function calling a click event on a hidden file input -- function in cristianoag only
    private handleCSVUploadClick = (event: any) => {
        this.setState({
            csvLoaded: "",
            csvError: true,
            csvusers: ""
        });

        //fire the fileinput click event and run the handle the CSV function
        this.CSVfileInput.current.click();
    };

    private makeDropdownItems = (items: any[] | undefined) => {
        const resultedTeams: dropdownItem[] = [];
        if (items) {
            items.forEach((element) => {
                resultedTeams.push({
                    key: element.id,
                    header: element.name,
                    content: element.mail,
                    image: ImageUtil.makeInitialImage(element.name),
                    team: {
                        id: element.id
                    },

                });
            });
        }
        return resultedTeams;
    }

    private makeDropdownItemList = (items: any[], fromItems: any[] | undefined) => {
        const dropdownItemList: dropdownItem[] = [];
        items.forEach(element =>
            dropdownItemList.push(
                typeof element !== "string" ? element : {
                    key: fromItems!.find(x => x.id === element).id,
                    header: fromItems!.find(x => x.id === element).name,
                    image: ImageUtil.makeInitialImage(fromItems!.find(x => x.id === element).name),
                    team: {
                        id: element
                    }
                })
        );
        return dropdownItemList;
    }

    public setDefaultCard = (card: any) => {
        const titleAsString = this.localize("TitleText");
        const summaryAsString = this.localize("Summary");
        const authorAsString = this.localize("Author1");
        const buttonTitleAsString = this.localize("ButtonTitle");

        setCardTitle(card, titleAsString);
        let imgUrl = getBaseUrl() + "/image/imagePlaceholder.png";
        setCardImageLink(card, imgUrl);
        setCardSummary(card, summaryAsString);
        setCardAuthor(card, authorAsString);
        // setCardBtn(card, buttonTitleAsString, "https://adaptivecards.io");
        // instead of setCardBtns(..);
        setCardBtns(card, [{
            "type": "Action.OpenUrl",
            "title": "Button",
            "url": ""
        }]);
    }

    private getTeamList = async () => {
        try {
            const response = await getTeams();
            this.setState({
                teams: response.data
            });
        } catch (error) {
            return error;
        }
    }

    private getGroupItems() {
        if (this.state.groups) {
            return this.makeDropdownItems(this.state.groups);
        }
        const dropdownItems: dropdownItem[] = [];
        return dropdownItems;
    }

    private setGroupAccess = async () => {
        await verifyGroupAccess().then(() => {
            this.setState({
                groupAccess: true
            });
        }).catch((error) => {
            const errorStatus = error.response.status;
            if (errorStatus === 403) {
                this.setState({
                    groupAccess: false
                });
            }
            else {
                throw error;
            }
        });
    }

    private getGroupData = async (id: number) => {
        try {
            const response = await getGroups(id);
            this.setState({
                groups: response.data
            });
        }
        catch (error) {
            return error;
        }
    }

    private getItem = async (id: number) => {
        try {

            const response = await getDraftNotification(id);
            const draftMessageDetail = response.data;

            //temp message to update the csvLoaded -- line in cristianoag only
            let csvMsg = "";

            let selectedRadioButton = "teams";
            if (draftMessageDetail.rosters.length > 0) {
                selectedRadioButton = "rosters";
            }
            else if (draftMessageDetail.groups.length > 0) {
                selectedRadioButton = "groups";
            }
            // else-if statement in cristianoag only
            else if (draftMessageDetail.csvUsers.length > 0) { //we have a message sending to CSV users
                selectedRadioButton = "csv"; //select the csv option radio
                csvMsg = this.localize("CSVLoaded"); //update the message that will update the state
            }
            else if (draftMessageDetail.allUsers) {
                selectedRadioButton = "allUsers";
            }

            

            // set state based on values returned 
            this.setState({
                teamsOptionSelected: draftMessageDetail.teams.length > 0,
                selectedTeamsNum: draftMessageDetail.teams.length,
                rostersOptionSelected: draftMessageDetail.rosters.length > 0,
                selectedRostersNum: draftMessageDetail.rosters.length,
                groupsOptionSelected: draftMessageDetail.groups.length > 0,
                selectedGroupsNum: draftMessageDetail.groups.length,
                selectedRadioBtn: selectedRadioButton,
                selectedTeams: draftMessageDetail.teams,
                selectedRosters: draftMessageDetail.rosters,
                selectedGroups: draftMessageDetail.groups,
                selectedSchedule: draftMessageDetail.isScheduled,
                // line in cristianoag only:
                selectedImportant: draftMessageDetail.isImportant,
                scheduledDate: draftMessageDetail.scheduledDate,
                // line(s) in cristianoag only:
                csvusers: draftMessageDetail.csvUsers, //update the state with the list of users (JSON)
                csvLoaded: csvMsg, //updates the message that will be presented in the text field
                csvError: !(csvMsg.length > 0), //state that stores the csv syntax analysis status
                csvOptionSelected: (csvMsg.length > 0), //to show the fields and allow updates
            });

            // set card properties
            setCardTitle(this.card, draftMessageDetail.title);
            setCardImageLink(this.card, draftMessageDetail.imageLink);
            setCardSummary(this.card, draftMessageDetail.summary);
            setCardAuthor(this.card, draftMessageDetail.author);
            // setCardBtn(this.card, draftMessageDetail.buttonTitle, draftMessageDetail.buttonLink);

            // if...else... statement in cristianoag only:
            // this is to ensure compatibility with older versions
            // if we get empty buttonsJSON and values on buttonTitle and buttonLink, we insert those to values
            // if not we just use values cause the JSON will be complete over there
            if (draftMessageDetail.buttonTitle && draftMessageDetail.buttonLink && !draftMessageDetail.buttons) {
                this.setState({
                    values: [{
                        "type": "Action.OpenUrl",
                        "title": draftMessageDetail.buttonTitle,
                        "url": draftMessageDetail.buttonLink
                    }]
                });
             }
            else {
                // set the values state with the parse of the JSON recovered from the database
                if (draftMessageDetail.buttons !== null) { //if the database value is not null, parse the JSON to create the button objects
                    this.setState({
                        values: JSON.parse(draftMessageDetail.buttons)
                    });
                } else { //if the string is null, then initialize the empty collection 
                    this.setState({
                        values: []
                    });
                }
            }

            // line in cristianoag only:
            // set the card buttons collection based on the values collection
            setCardBtns(this.card, this.state.values);


            this.setState({
                title: draftMessageDetail.title,
                summary: draftMessageDetail.summary,
                btnLink: draftMessageDetail.buttonLink,
                imageLink: draftMessageDetail.imageLink,
                btnTitle: draftMessageDetail.buttonTitle,
                author: draftMessageDetail.author,
                allUsersOptionSelected: draftMessageDetail.allUsers,
                loader: false
            }, () => {
                this.updateCard();
            });
        } catch (error) {
            return error;
        }
    }

    public componentWillUnmount() {
        document.removeEventListener("keydown", this.escFunction, false);
    }

    public render(): JSX.Element {
        // // Initialize a markdown parser
        // const mdParser = new MarkdownIt({
        //     html: true,
        //     linkify: true,
        //     typographer: true,
        // });

        if (this.state.loader) {
            return (
                <div className="Loader">
                    <Loader />
                </div>
            );
        } else {
            if (this.state.page === "CardCreation") {
                return (
                    <div className="taskModule">
                        {/* below Flex can also have styles={{ background: "white" }} */}
                        <Flex column className="formContainer" vAlign="stretch" gap="gap.small">
                            <Flex className="scrollableContent">
                                <Flex.Item size="size.half">
                                    <Flex column className="formContentContainer">
                                        <Input className="inputField"
                                            value={this.state.title}
                                            label={this.localize("TitleText")}
                                            placeholder={this.localize("PlaceHolderTitle")}
                                            onChange={this.onTitleChanged}
                                            autoComplete="off"
                                            fluid
                                        />
                                        <Flex gap="gap.smaller" vAlign="end" className="inputField">
                                            <Input
                                                value={this.state.imageLink}
                                                label={this.localize("ImageURL")}
                                                placeholder={this.localize("ImageURLPlaceHolder")}
                                                onChange={this.onImageLinkChanged}
                                                error={!(this.state.errorImageUrlMessage === "")}
                                                autoComplete="off"
                                                fluid
                                            />
                                            <input type="file" accept="image/"
                                                style={{ display: 'none' }}
                                                onChange={this.handleImageSelection}
                                                ref={this.fileInput} />
                                            <Flex.Item push>
                                                <Button circular onClick={this.handleUploadClick}
                                                    size="small"
                                                    icon={<FilesUploadIcon />}
                                                    // not content={this.localize("UploadImage")}
                                                    title={this.localize("UploadImage")}
                                                />
                                            </Flex.Item>
                                        </Flex>
                                        <Text className={(this.state.errorImageUrlMessage === "") ? "hide" : "show"} error size="small" content={this.state.errorImageUrlMessage} />

                                        <div className="textArea">
                                            <Text content={this.localize("Summary")} />
                                            <SimpleMarkdownEditor
                                                textAreaID="summary123"
                                                styles={{button: {backgroundColor:'white', color:'#333536', border:'1px solid black'}}}
                                                enabledButtons={{strike:false, quote:false, h1:false, h2:false, h3:false, code:false, image:false}}
                                                buttonHtmlText={{link:'&#8766;'}}
                                            />
                                            <TextArea
                                                autoFocus
                                                placeholder={this.localize("Summary")}
                                                id="summary123"
                                                value={this.state.summary}
                                                onChange={this.onSummaryChanged}
                                                fluid />
                                        </div>

                                        {/* <div>
                                            <p className='sum-label'>Summary</p>
                                            <MdEditor
                                                style={{margin: "20px auto",
                                                width: "100%"}}
                                                renderHTML={(text) => mdParser.render(text)}
                                                onChange={({html, text})=> {    
                                                    console.log( html, text)
                                                    let showDefaultCard = (!this.state.title && !this.state.imageLink && !this.state.summary && !text && !this.state.btnTitle && !this.state.btnLink);   
                                                    setCardSummary(this.card, text);
                                                    this.setState({
                                                        summary: text,
                                                        card: this.card
                                                    }, () => {
                                                        if (showDefaultCard) {
                                                            this.setDefaultCard(this.card);
                                                        }
                                                        this.updateCard();
                                                    });
                                                }}
                                                onImageUpload={this.handleImageUpload}
                                                />
                                        </div> */}

                                        <Input className="inputField"
                                            value={this.state.author}
                                            label={this.localize("Author")}
                                            placeholder={this.localize("Author")}
                                            onChange={this.onAuthorChanged}
                                            autoComplete="off"
                                            fluid
                                        />

                                        {/* lines 629-638 is in cristianoag only */}
                                        <div className="textArea">
                                            <Flex gap="gap.large" vAlign="end">
                                                <Text size="small" align="start" content={this.localize("Buttons")} />
                                                <Flex.Item push >
                                                    <Button circular size="small" disabled={(this.state.values.length == 4) || !(this.state.errorButtonUrlMessage === "")} icon={ <AddIcon />} title={this.localize("Add")} onClick={this.addClick.bind(this)} />
                                                </Flex.Item>
                                            </Flex>
                                        </div>
                                        
                                        {this.createUI()}

                                        <Text className={(this.state.errorButtonUrlMessage === "") ? "hide" : "show"} error size="small" content={this.state.errorButtonUrlMessage} />
                                    </Flex>
                                </Flex.Item>
                                <Flex.Item size="size.half">
                                    <div className="adaptiveCardContainer">
                                    </div>
                                </Flex.Item>
                            </Flex>

                            <Flex className="footerContainer" vAlign="end" hAlign="end">
                                <Flex className="buttonContainer">
                                    <Button content={this.localize("Next")} disabled={this.isNextBtnDisabled()} id="saveBtn" onClick={this.onNext} primary />
                                </Flex>
                            </Flex>

                        </Flex>
                    </div>
                );
            }
            else if (this.state.page === "AudienceSelection") {
                return (
                    <div className="taskModule">
                        {/* below Flex can also have styles={{ background: "white" }} */}
                        <Flex column className="formContainer" vAlign="stretch" gap="gap.small">
                            <Flex className="scrollableContent">
                                <Flex.Item size="size.half">
                                    <Flex column className="formContentContainer">
                                        <h3>{this.localize("SendHeadingText")}</h3>
                                        <RadioGroup
                                            className="radioBtns"
                                            checkedValue={this.state.selectedRadioBtn}
                                            onCheckedValueChange={this.onGroupSelected}
                                            vertical={true}
                                            items={[
                                                {
                                                    name: "teams",
                                                    key: "teams",
                                                    value: "teams",
                                                    label: this.localize("SendToGeneralChannel"),
                                                    children: (Component, { name, ...props }) => {
                                                        return (
                                                            <Flex key={name} column>
                                                                <Component {...props} />
                                                                <Dropdown
                                                                    hidden={!this.state.teamsOptionSelected}
                                                                    placeholder={this.localize("SendToGeneralChannelPlaceHolder")}
                                                                    search
                                                                    multiple
                                                                    items={this.getItems()}
                                                                    value={this.state.selectedTeams}
                                                                    onChange={this.onTeamsChange}
                                                                    noResultsMessage={this.localize("NoMatchMessage")}
                                                                />
                                                            </Flex>
                                                        )
                                                    },
                                                },
                                                {
                                                    name: "rosters",
                                                    key: "rosters",
                                                    value: "rosters",
                                                    label: this.localize("SendToRosters"),
                                                    children: (Component, { name, ...props }) => {
                                                        return (
                                                            <Flex key={name} column>
                                                                <Component {...props} />
                                                                <Dropdown
                                                                    hidden={!this.state.rostersOptionSelected}
                                                                    placeholder={this.localize("SendToRostersPlaceHolder")}
                                                                    search
                                                                    multiple
                                                                    items={this.getItems()}
                                                                    value={this.state.selectedRosters}
                                                                    onChange={this.onRostersChange}
                                                                    unstable_pinned={this.state.unstablePinned}
                                                                    noResultsMessage={this.localize("NoMatchMessage")}
                                                                />
                                                            </Flex>
                                                        )
                                                    },
                                                },
                                                {
                                                    name: "allUsers",
                                                    key: "allUsers",
                                                    value: "allUsers",
                                                    label: this.localize("SendToAllUsers"),
                                                    children: (Component, { name, ...props }) => {
                                                        return (
                                                            <Flex key={name} column>
                                                                <Component {...props} />
                                                                <div className={this.state.selectedRadioBtn === "allUsers" ? "" : "hide"}>
                                                                    <div className="noteText">
                                                                        <Text error content={this.localize("SendToAllUsersNote")} />
                                                                    </div>
                                                                </div>
                                                            </Flex>
                                                        )
                                                    },
                                                },
                                                {
                                                    name: "groups",
                                                    key: "groups",
                                                    value: "groups",
                                                    label: this.localize("SendToGroups"),
                                                    children: (Component, { name, ...props }) => {
                                                        return (
                                                            <Flex key={name} column>
                                                                <Component {...props} />
                                                                <div className={this.state.groupsOptionSelected && !this.state.groupAccess ? "" : "hide"}>
                                                                    <div className="noteText">
                                                                        <Text error content={this.localize("SendToGroupsPermissionNote")} />
                                                                    </div>
                                                                </div>
                                                                <Dropdown
                                                                    className="hideToggle"
                                                                    hidden={!this.state.groupsOptionSelected || !this.state.groupAccess}
                                                                    placeholder={this.localize("SendToGroupsPlaceHolder")}
                                                                    search={this.onGroupSearch}
                                                                    multiple
                                                                    loading={this.state.loading}
                                                                    loadingMessage={this.localize("LoadingText")}
                                                                    items={this.getGroupItems()}
                                                                    value={this.state.selectedGroups}
                                                                    onSearchQueryChange={this.onGroupSearchQueryChange}
                                                                    onChange={this.onGroupsChange}
                                                                    noResultsMessage={this.state.noResultMessage}
                                                                    unstable_pinned={this.state.unstablePinned}
                                                                />
                                                                <div className={this.state.groupsOptionSelected && this.state.groupAccess ? "" : "hide"}>
                                                                    <div className="noteText">
                                                                        <Text error content={this.localize("SendToGroupsNote")} />
                                                                    </div>
                                                                </div>
                                                            </Flex>
                                                        )
                                                    },
                                                },
                                                {
                                                    name: "csv",
                                                    key: "csv",
                                                    value: "csv",
                                                    label: this.localize("SendToCSV"),
                                                    children: (Component, { name, ...props }) => {
                                                        return (
                                                            <Flex key={name} column debug={false}>
                                                                <Component {...props} />
                                                                <Flex gap="gap.smaller" debug={false} vAlign="end" className="csvUpload" hidden={!this.state.csvOptionSelected}>
                                                                    <Input
                                                                        value={this.state.csvLoaded}
                                                                        //value="TESTE"
                                                                        //label={this.localize("ImageURL")}
                                                                        //placeholder={this.localize("ImageURLPlaceHolder")}
                                                                        //onChange={this.onImageLinkChanged}
                                                                        error={this.state.csvError}
                                                                        autoComplete="off"
                                                                        disabled={true}
                                                                        fluid
                                                                    />
                                                                    <input type="file" accept="csv/"
                                                                        style={{ display: 'none' }}
                                                                        onChange={this.handleCSVSelection}
                                                                        ref={this.CSVfileInput} />
                                                                    <Flex.Item push>
                                                                        <Button circular onClick={this.handleCSVUploadClick}
                                                                            size="small"
                                                                            icon={<FilesUploadIcon />}
                                                                            title={this.localize("LabelCSV")}
                                                                        />
                                                                    </Flex.Item>
                                                                 </Flex>
                                                            </Flex>
                                                        )
                                                    },
                                                }
                                            ]}
                                        >
                                        </RadioGroup>

                                        <Flex hAlign="start">
                                         <h3><Checkbox
                                            className="ScheduleCheckbox"
                                            labelPosition="start"
                                            onClick={this.onScheduleSelected}
                                            label={this.localize("ScheduledSend")}
                                            checked={this.state.selectedSchedule}
                                            toggle
                                            /></h3>
                                        </Flex>
                                        <Text size="small" align="start" content={this.localize('ScheduledSendDescription')} />
                                        <Flex gap="gap.smaller" className="DateTimeSelector">
                                            <Datepicker
                                                disabled={!this.state.selectedSchedule}
                                                defaultSelectedDate={this.getDateObject(this.state.scheduledDate)}
                                                minDate={new Date()}
                                                inputOnly
                                                onDateChange={this.handleDateChange}
                                            />
                                            <Flex.Item shrink={true} size="1%">
                                                <Dropdown
                                                    placeholder="hour"
                                                    disabled={!this.state.selectedSchedule}
                                                    fluid={true}
                                                    items={hours}
                                                    defaultValue={this.getDateHour(this.state.scheduledDate)}
                                                    onChange={this.handleHourChange}
                                                />
                                            </Flex.Item>
                                            <Flex.Item shrink={true} size="1%">
                                                <Dropdown
                                                    placeholder="mins"
                                                    disabled={!this.state.selectedSchedule}
                                                    fluid={true}
                                                    items={minutes}
                                                    defaultValue={this.getDateMins(this.state.scheduledDate)}
                                                    onChange={this.handleMinsChange}
                                                />
                                            </Flex.Item>
                                        </Flex>
                                        <div className={this.state.futuredate && this.state.selectedSchedule ? "ErrorMessage" : "hide"}>
                                            <div className="noteText">
                                                <Text error content={this.localize('FutureDateError')} />
                                            </div>
                                        </div>
                                        <Flex hAlign="start">
                                            <h3><Checkbox
                                                className="Important"
                                                labelPosition="start"
                                                onClick={this.onImportantSelected}
                                                label={this.localize("Important")}
                                                checked={this.state.selectedImportant}
                                                toggle
                                            /></h3>
                                        </Flex>
                                        <Text size="small" align="start" content={this.localize('ImportantDescription')} />
                                    </Flex>
                                </Flex.Item>
                                <Flex.Item size="size.half">
                                    <div className="adaptiveCardContainer">
                                    </div>
                                </Flex.Item>
                            </Flex>
                            <Flex className="footerContainer" vAlign="end" hAlign="end">
                                <Flex className="buttonContainer" gap="gap.medium">
                                    <Button content={this.localize("Back")} onClick={this.onBack} secondary />
                                    <Flex.Item push>
                                        <Button
                                            content="Schedule"
                                            disabled={this.isSaveBtnDisabled() || !this.state.selectedSchedule}
                                            onClick={this.onSchedule}
                                            primary={this.state.selectedSchedule} />
                                    </Flex.Item>
                                    <Button content={this.localize("SaveAsDraft")}
                                        disabled={this.isSaveBtnDisabled() || this.state.selectedSchedule}
                                        id="saveBtn"
                                        onClick={this.onSave}
                                        primary={!this.state.selectedSchedule} />
                                </Flex>
                            </Flex>
                        </Flex>
                    </div>
                );
            } else {
                return (<div>Error</div>);
            }
        }
    }

    //get the next rounded up (ceil) date in minutes
    private getRoundedDate = (minutes: number, d = new Date()) => {

        let ms = 1000 * 60 * minutes; // convert minutes to ms
        let roundedDate = new Date(Math.ceil(d.getTime() / ms) * ms);

        return roundedDate
    }

    //get date object based on the string parameter
    private getDateObject = (datestring?: string) => {
        if (!datestring) {
            var TempDate = new Date(); //get current date
            TempDate.setTime(TempDate.getTime() + 86400000);
            return TempDate; //if date string is not provided, then return tomorrow rounded up next 5 minutes
        }
        return new Date(datestring); //if date string is provided, return current date object
    }

    //get the hour of the datestring
    private getDateHour = (datestring: string) => {
        if (!datestring) return "00";
        var thour = new Date(datestring).getHours().toString();
        return thour.padStart(2, "0");
    }

    //get the mins of the datestring
    private getDateMins = (datestring: string) => {
        if (!datestring) return "00";
        var tmins = new Date(datestring).getMinutes().toString();
        return tmins.padStart(2, "0");
    }

    //handles click on DatePicker to change the schedule date
    private handleDateChange = (e: any, v: any) => {
        var TempDate = v.value; //set the tempdate var with the value selected by the user
        TempDate.setMinutes(parseInt(this.state.DMYMins)); //set the minutes selected on minutes drop down 
        TempDate.setHours(parseInt(this.state.DMYHour)); //set the hour selected on hour drop down
        //set the state variables
        this.setState({
            scheduledDate: TempDate.toUTCString(), //updates the state string representation
            DMY: TempDate, //updates the date on the state
        });
    }

    //handles selection on the hour combo
    private handleHourChange = (e: any, v: any) => {
        var TempDate = this.state.DMY; //get the tempdate from the state
        TempDate.setHours(parseInt(v.value)); //set hour with the value select on the hour drop down
        //set state variables
        this.setState({
            scheduledDate: TempDate.toUTCString(), //updates the string representation 
            DMY: TempDate, //updates DMY
            DMYHour: v.value, //set the new hour value on the state
        });
    }

    //handles selection on the minutes combo
    private handleMinsChange = (e: any, v: any) => {
        var TempDate = this.state.DMY; //get the tempdate from the state
        TempDate.setMinutes(parseInt(v.value)); //set minutes with the value select on the minutes drop down
        //set state variables
        this.setState({
            scheduledDate: TempDate.toUTCString(), //updates the string representation 
            DMY: TempDate, //updates DMY
            DMYMins: v.value, //set the bew minutes on the state
        });
    }

    //handler for the Schedule Send checkbox
    private onScheduleSelected = () => {
        var TempDate = this.getRoundedDate(5, this.getDateObject()); //get the next day date rounded to the nearest hour/minute
        //set the state
        this.setState({
            selectedSchedule: !this.state.selectedSchedule,
            scheduledDate: TempDate.toUTCString(),
            DMY: TempDate
        });
    }

    // handler for the important message checkbox -- in cristianoag only
    private onImportantSelected = () => {
        this.setState({
            selectedImportant: !this.state.selectedImportant
        });
    }

    private onGroupSelected = (event: any, data: any) => {
        this.setState({
            selectedRadioBtn: data.value,
            teamsOptionSelected: data.value === 'teams',
            rostersOptionSelected: data.value === 'rosters',
            groupsOptionSelected: data.value === 'groups',
            csvOptionSelected: data.value === 'csv',
            allUsersOptionSelected: data.value === 'allUsers',
            selectedTeams: data.value === 'teams' ? this.state.selectedTeams : [],
            selectedTeamsNum: data.value === 'teams' ? this.state.selectedTeamsNum : 0,
            selectedRosters: data.value === 'rosters' ? this.state.selectedRosters : [],
            selectedRostersNum: data.value === 'rosters' ? this.state.selectedRostersNum : 0,
            selectedGroups: data.value === 'groups' ? this.state.selectedGroups : [],
            selectedGroupsNum: data.value === 'groups' ? this.state.selectedGroupsNum : 0,
        });
    }

    private isSaveBtnDisabled = () => {
        const teamsSelectionIsValid = (this.state.teamsOptionSelected && (this.state.selectedTeamsNum !== 0)) || (!this.state.teamsOptionSelected);
        const rostersSelectionIsValid = (this.state.rostersOptionSelected && (this.state.selectedRostersNum !== 0)) || (!this.state.rostersOptionSelected);
        const groupsSelectionIsValid = (this.state.groupsOptionSelected && (this.state.selectedGroupsNum !== 0)) || (!this.state.groupsOptionSelected);
        const csvSelectionIsValid = (!(this.state.csvError) && (!(this.state.csvLoaded === "") && this.state.csvOptionSelected)) || (!this.state.csvOptionSelected);
        const nothingSelected = (!this.state.teamsOptionSelected) && (!this.state.rostersOptionSelected) && (!this.state.groupsOptionSelected) && (!this.state.allUsersOptionSelected) && (!this.state.csvOptionSelected);
        return (!teamsSelectionIsValid || !rostersSelectionIsValid || !groupsSelectionIsValid || nothingSelected || !csvSelectionIsValid)
    }

    private isNextBtnDisabled = () => {
        const title = this.state.title;
        return !(title && (this.state.errorButtonUrlMessage === ""));
    }

    private getItems = () => {
        const resultedTeams: dropdownItem[] = [];
        if (this.state.teams) {
            let remainingUserTeams = this.state.teams;
            if (this.state.selectedRadioBtn !== "allUsers") {
                if (this.state.selectedRadioBtn === "teams") {
                    this.state.teams.filter(x => this.state.selectedTeams.findIndex(y => y.team.id === x.id) < 0);
                }
                else if (this.state.selectedRadioBtn === "rosters") {
                    this.state.teams.filter(x => this.state.selectedRosters.findIndex(y => y.team.id === x.id) < 0);
                }
            }
            remainingUserTeams.forEach((element) => {
                resultedTeams.push({
                    key: element.id,
                    header: element.name,
                    content: element.mail,
                    image: ImageUtil.makeInitialImage(element.name),
                    team: {
                        id: element.id
                    }
                });
            });
        }
        return resultedTeams;
    }

    private static MAX_SELECTED_TEAMS_NUM: number = 20;

    private onTeamsChange = (event: any, itemsData: any) => {
        if (itemsData.value.length > NewMessage.MAX_SELECTED_TEAMS_NUM) return;
        this.setState({
            selectedTeams: itemsData.value,
            selectedTeamsNum: itemsData.value.length,
            selectedRosters: [],
            selectedRostersNum: 0,
            selectedGroups: [],
            selectedGroupsNum: 0
        })
    }

    private onRostersChange = (event: any, itemsData: any) => {
        if (itemsData.value.length > NewMessage.MAX_SELECTED_TEAMS_NUM) return;
        this.setState({
            selectedRosters: itemsData.value,
            selectedRostersNum: itemsData.value.length,
            selectedTeams: [],
            selectedTeamsNum: 0,
            selectedGroups: [],
            selectedGroupsNum: 0
        })
    }

    private onGroupsChange = (event: any, itemsData: any) => {
        this.setState({
            selectedGroups: itemsData.value,
            selectedGroupsNum: itemsData.value.length,
            groups: [],
            selectedTeams: [],
            selectedTeamsNum: 0,
            selectedRosters: [],
            selectedRostersNum: 0
        })
    }

    private onGroupSearch = (itemList: any, searchQuery: string) => {
        const result = itemList.filter(
            (item: { header: string; content: string; }) => (item.header && item.header.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1) ||
                (item.content && item.content.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1),
        )
        return result;
    }

    private onGroupSearchQueryChange = async (event: any, itemsData: any) => {

        if (!itemsData.searchQuery) {
            this.setState({
                groups: [],
                noResultMessage: "",
            });
        }
        else if (itemsData.searchQuery && itemsData.searchQuery.length <= 2) {
            this.setState({
                loading: false,
                noResultMessage: this.localize("NoMatchMessage"),
            });
        }
        else if (itemsData.searchQuery && itemsData.searchQuery.length > 2) {
            // handle event trigger on item select.
            const result = itemsData.items && itemsData.items.find(
                (item: { header: string; }) => item.header.toLowerCase() === itemsData.searchQuery.toLowerCase()
            )
            if (result) {
                return;
            }

            this.setState({
                loading: true,
                noResultMessage: "",
            });

            try {
                const query = encodeURIComponent(itemsData.searchQuery);
                const response = await searchGroups(query);
                this.setState({
                    groups: response.data,
                    loading: false,
                    noResultMessage: this.localize("NoMatchMessage")
                });
            }
            catch (error) {
                return error;
            }
        }
    }

    //called when the user clicks to schedule the message
    private onSchedule = () => {
        var Today = new Date(); //today date
        var Scheduled = new Date(this.state.DMY); //scheduled date

        //only allow the save when the scheduled date is 30 mins in the future, if that is the case calls the onSave function
        if (Scheduled.getTime() > Today.getTime() + 1800000) { this.onSave() }
        else {
            //set the state to indicate future date error
            //if futuredate is true, an error message is shown right below the date selector
            this.setState({
                futuredate: true
            })
        }
    }

    //called to save the draft
    private onSave = () => {
        const selectedTeams: string[] = [];
        const selctedRosters: string[] = [];
        const selectedGroups: string[] = [];
        let selectedCSV = "";

        this.state.selectedTeams.forEach(x => selectedTeams.push(x.team.id));
        this.state.selectedRosters.forEach(x => selctedRosters.push(x.team.id));
        this.state.selectedGroups.forEach(x => selectedGroups.push(x.team.id));

        if (this.state.csvOptionSelected) { selectedCSV = this.state.csvusers;}

        const draftMessage: IDraftMessage = {
            id: this.state.messageId,
            title: this.state.title,
            imageLink: this.state.imageLink,
            summary: this.state.summary,
            author: this.state.author,
            buttonTitle: this.state.btnTitle,
            buttonLink: this.state.btnLink,
            teams: selectedTeams,
            rosters: selctedRosters,
            groups: selectedGroups,
            csvusers: selectedCSV,
            allUsers: this.state.allUsersOptionSelected,
            isScheduled: this.state.selectedSchedule,
            isImportant: this.state.selectedImportant,
            ScheduledDate: new Date(this.state.scheduledDate),
            Buttons: JSON.stringify(this.state.values)
        };

        if (this.state.exists) {
            this.editDraftMessage(draftMessage).then(() => {
                microsoftTeams.tasks.submitTask();
            });
        } else {
            this.postDraftMessage(draftMessage).then(() => {
                microsoftTeams.tasks.submitTask();
            });
        }
    }

    private editDraftMessage = async (draftMessage: IDraftMessage) => {
        try {
            await updateDraftNotification(draftMessage);
        } catch (error) {
            return error;
        }
    }

    private postDraftMessage = async (draftMessage: IDraftMessage) => {
        try {
            await createDraftNotification(draftMessage);
        } catch (error) {
            throw error;
        }
    }

    public escFunction(event: any) {
        if (event.keyCode === 27 || (event.key === "Escape")) {
            microsoftTeams.tasks.submitTask();
        }
    }

    private onNext = (event: any) => {
        this.setState({
            page: "AudienceSelection"
        }, () => {
            this.updateCard();
        });
    }

    private onBack = (event: any) => {
        this.setState({
            page: "CardCreation"
        }, () => {
            this.updateCard();
        });
    }

    private onTitleChanged = (event: any) => {
        let showDefaultCard = (!event.target.value && !this.state.imageLink && !this.state.summary && !this.state.author && !this.state.btnTitle && !this.state.btnLink);
        setCardTitle(this.card, event.target.value);
        setCardImageLink(this.card, this.state.imageLink);
        setCardSummary(this.card, this.state.summary);
        setCardAuthor(this.card, this.state.author);
        setCardBtns(this.card, this.state.values);
        // setCardBtn(this.card, this.state.btnTitle, this.state.btnLink);
        this.setState({
            title: event.target.value,
            card: this.card
        }, () => {
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        });
    }

    private onImageLinkChanged = (event: any) => {
        let url = event.target.value.toLowerCase();
        if (!((url === "") || (url.startsWith("https://") || (url.startsWith("data:image/png;base64,")) || (url.startsWith("data:image/jpeg;base64,")) || (url.startsWith("data:image/gif;base64,"))))) {
            this.setState({
                errorImageUrlMessage: this.localize("ErrorURLMessage")
            });
        } else {
            this.setState({
                errorImageUrlMessage: ""
            });
        }

        let showDefaultCard = (!this.state.title && !event.target.value && !this.state.summary && !this.state.author && !this.state.btnTitle && !this.state.btnLink);
        setCardTitle(this.card, this.state.title);
        setCardImageLink(this.card, event.target.value);
        setCardSummary(this.card, this.state.summary);
        setCardAuthor(this.card, this.state.author);
        setCardBtns(this.card, this.state.values);
        // setCardBtn(this.card, this.state.btnTitle, this.state.btnLink);
        this.setState({
            imageLink: event.target.value,
            card: this.card
        }, () => {
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        });
    }

    private onSummaryChanged = (event: any) => {
        let showDefaultCard = (!this.state.title && !this.state.imageLink && !event.target.value && !this.state.author && !this.state.btnTitle && !this.state.btnLink);
        setCardTitle(this.card, this.state.title);
        setCardImageLink(this.card, this.state.imageLink);
        setCardSummary(this.card, event.target.value);
        setCardAuthor(this.card, this.state.author);
        setCardBtns(this.card, this.state.values);
        // setCardBtn(this.card, this.state.btnTitle, this.state.btnLink);
        this.setState({
            summary: event.target.value,
            card: this.card
        }, () => {
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        });
    }

    //if the author changes, updates the card with appropriate values
    private onAuthorChanged = (event: any) => {
        let showDefaultCard = (!this.state.title && !this.state.imageLink && !this.state.summary && !event.target.value && !this.state.btnTitle && !this.state.btnLink);
        setCardTitle(this.card, this.state.title);
        setCardImageLink(this.card, this.state.imageLink);
        setCardSummary(this.card, this.state.summary);
        setCardAuthor(this.card, event.target.value);
        setCardBtns(this.card, this.state.values);
        // setCardBtn(this.card, this.state.btnTitle, this.state.btnLink);
        this.setState({
            author: event.target.value,
            card: this.card
        }, () => {
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        });
    }

    // private function to create the buttons UI -- in cristianoag only
    private createUI() {
        if (this.state.values.length > 0) {
            return this.state.values.map((el, i) =>
                <Flex gap="gap.smaller" vAlign="center">
                    <Input className="inputField"
                        fluid
                        value={el.title || ''}
                        placeholder={this.localize("ButtonTitle")}
                        onChange={this.handleChangeName.bind(this, i)}
                        autoComplete="off"
                    />
                    <Input className="inputField"
                        fluid
                        value={el.url || ''}
                        placeholder={this.localize("ButtonURL")}
                        onChange={this.handleChangeLink.bind(this, i)}
                        error={!(this.state.errorButtonUrlMessage === "")}
                        autoComplete="off"
                    />
                    <Button
                        circular
                        size="small"
                        icon={<TrashCanIcon />}
                        onClick={this.removeClick.bind(this, i)}
                        title={this.localize("Delete")}
                    />
                </Flex>
            )
        } else {
            return (
                < Flex >
                    <Text size="small" content={this.localize("NoButtons") } />
                </Flex>
            )
        }
    }

    //private function to add a new button to the adaptive card -- in cristianoag only
    private addClick() {
        const item =
        {
            type: "Action.OpenUrl",
            title: "",
            url: ""
        };
        this.setState({
            values: [...this.state.values, item]
        });
    }

    //private function to remove a button from the adaptive card -- in cristianoag only
    private removeClick(i: any) {
        let values = [...this.state.values];
        values.splice(i, 1);
        this.setState({ values });

        const showDefaultCard = (!this.state.title && !this.state.imageLink && !this.state.summary && !this.state.author && values.length == 0);
        setCardTitle(this.card, this.state.title);
        setCardImageLink(this.card, this.state.imageLink);
        setCardSummary(this.card, this.state.summary);
        setCardAuthor(this.card, this.state.author);
        if (values.length > 0) { //only if there are buttons created
            setCardBtns(this.card, values); //update the adaptive card
            this.setState({
                card: this.card
            }, () => {
                if (showDefaultCard) {
                    this.setDefaultCard(this.card);
                }
                this.updateCard();
            });
        } else {
            this.setState({
                errorButtonUrlMessage: ""
            });
            delete this.card.actions;
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        };
    }

    //private function to deal with changes in the button names -- in cristianoag only
    private handleChangeName(i: any, event: any) {
        let values = [...this.state.values];
        values[i].title = event.target.value;
        this.setState({ values });

        const showDefaultCard = (!this.state.title && !this.state.imageLink && !this.state.summary && !this.state.author && !event.target.value && values.length == 0);
        setCardTitle(this.card, this.state.title);
        setCardImageLink(this.card, this.state.imageLink);
        setCardSummary(this.card, this.state.summary);
        setCardAuthor(this.card, this.state.author);
        if (values.length > 0) { //only if there are buttons created
            setCardBtns(this.card, values); //update the adaptive card
            this.setState({
                card: this.card
            }, () => {
                if (showDefaultCard) {
                    this.setDefaultCard(this.card);
                }
                this.updateCard();
            });
        } else {
            delete this.card.actions;
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        };
    }

    //private function to deal with changes in the button links/urls -- in cristianoag only
    private handleChangeLink(i: any, event: any) {
        let values = [...this.state.values];
        values[i].url = event.target.value;
        this.setState({ values });

        //set the error message if the links have wrong values
        //alert(values.findIndex(element => element.includes("https://")));
        if (!(event.target.value === "" || event.target.value.toLowerCase().startsWith("https://"))) {
            this.setState({
                errorButtonUrlMessage: this.localize("ErrorURLMessage")
            });
        } else {
            this.setState({
                errorButtonUrlMessage: ""
            });
        }

        const showDefaultCard = (!this.state.title && !this.state.imageLink && !this.state.summary && !this.state.author && !event.target.value && values.length == 0);
        setCardTitle(this.card, this.state.title);
        setCardImageLink(this.card, this.state.imageLink);
        setCardSummary(this.card, this.state.summary);
        setCardAuthor(this.card, this.state.author);
        if (values.length > 0) {
            setCardBtns(this.card, values); //update the card
            this.setState({
                card: this.card
            }, () => {
                if (showDefaultCard) {
                    this.setDefaultCard(this.card);
                }
                this.updateCard();
            });
        } else {
            delete this.card.actions;
            if (showDefaultCard) {
                this.setDefaultCard(this.card);
            }
            this.updateCard();
        };
    }

    private updateCard = () => {
        const adaptiveCard = new AdaptiveCards.AdaptiveCard();
        adaptiveCard.parse(this.state.card);
        const renderedCard = adaptiveCard.render();
        const container = document.getElementsByClassName('adaptiveCardContainer')[0].firstChild;
        if (container != null) {
            container.replaceWith(renderedCard);
        } else {
            document.getElementsByClassName('adaptiveCardContainer')[0].appendChild(renderedCard);
        }
        const link = this.state.btnLink;
        adaptiveCard.onExecuteAction = function (action) { window.open(link, '_blank'); }
    }
}

const newMessageWithTranslation = withTranslation()(NewMessage);
export default newMessageWithTranslation;