import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import TwitterLogin from 'react-twitter-auth';
import SelectAccountsModal from './Accounts/SelectAccountsModal';
import { startSetChannels, startAddFacebookChannel, startAddLinkedinChannel, startAddPinterestChannel, startAddTwitterChannel } from "../actions/channels";
import { startSetProfile } from "../actions/profile";
import { getAccounts, saveAccounts } from "../requests/facebook/channels";
import FacebookLogin from 'react-facebook-login';
import { twitterRequestTokenUrl, twitterAccessTokenUrl, backendUrl, facebookAppId, linkedinAppId, pinterestAppId } from "../config/api";
import LinkedInButton from "./LinkedInButton";
import { changePlan, activateAddon } from '../requests/billing';
// import PinterestButton from "./PinterestButton";
import channelSelector, { findAccounts } from "../selectors/channels";
import { fbFields, fbScope } from "./FacebookButton";
import { destroyChannel } from "../requests/channels";
import Loader, { LoaderWithOverlay } from './Loader';
import { getParameterByName } from "../utils/helpers";
import ChannelItems from "./Accounts/ChannelItems";
import { getPages, savePages } from "../requests/linkedin/channels";
import Modal from './Modal';
import ReactModal from 'react-modal';

class ConnectAccounts extends React.Component {
    state = {
        bussinesPagesModal: false,
        bussinesPages: [],
        twitterBooster: this.props.location.search.indexOf('twitter-booster') != -1,
        billingPeriod: getParameterByName("period", this.props.location.search) || "annually",
        plan: getParameterByName("plan", this.props.location.search),
        addon: getParameterByName("addon", this.props.location.search),
        addonTrial: getParameterByName("addontrial", this.props.location.search),
        allPlans: [],
        loading: false,
        forbidden: false,
        addAccounts: "",
        accountsModal: false,
        message: '',
    }

    twitterRef = React.createRef();
    facebookRef = React.createRef();
    linkedinRef = React.createRef();

    componentDidMount() {
    }

    componentDidUpdate(prevProps) {
    }

    defaultAction = {
        id: "",
        type: ""
    };


    onFailure = (response) => {
        this.setState(() => ({ loading: false }));
    };

    setForbidden = (forbidden = false) => {
        this.setState(() => ({
            forbidden
        }));
    };

    setLoading = (loading = false) => {
        this.setState(() => ({
            loading
        }));
    };

    setRole = () => {
        let plan = getParameterByName("plan", this.props.location.search);
        let addon = getParameterByName("addon", this.props.location.search);
        this.setState(() => ({ loading: true }));

        if (plan) {
            changePlan(plan).then(response => {
                this.props.startSetProfile().then(() => {
                    this.setState(() => ({ loading: false }));
                });
            }).then()
                .catch(error => {
                    if (error.response.status === 403) {
                        this.setState(() => ({
                            forbidden: true,
                            error: error.response.data.error,
                            redirect: error.response.data.redirect
                        }))
                    } else {
                        this.setError("Something went wrong!");
                    }
                });

            return;
        }

        if (addon) {
            activateAddon(addon).then(response => {
                this.props.startSetProfile();
            });

            return;
        }

        this.props.startSetProfile().then(() => {
            this.setState(() => ({ loading: false }));
        });
    };

    onTwitterSuccess = (response) => {
        this.setState(() => ({ loading: true }));

        try {
            response.json().then(body => {
                this.props.startAddTwitterChannel(body.oauth_token, body.oauth_token_secret)
                    .then(() => {
                        this.setState(() => ({ loading: false, addAccounts: "twitter" }));
                    }).catch(error => {
                        this.setState(() => ({ loading: false }));
                        if (error.response.status === 409) {
                            Modal({
                                type: 'error',
                                title: 'Error',
                                content: 'This account is currently being used by other Uniclix users, please contact our helpdesk support for additional details'
                            });
                        } else if (error.response.status === 432) {
                            Modal({
                                type: 'confirm',
                                title: 'Error',
                                content: 'You reached the limit of accounts for your current plan. Please upgrade to continue adding them.',
                                okText: 'Upgrade',
                                onOk: this.props.goToUpgrade
                            });
                        } else {
                            Modal({
                                type: 'error',
                                title: 'Error',
                                content: 'Something went wrong!'
                            });
                        }
                    });
            });
        } catch (e) {
        }
    };

    onFacebookSuccess = (response) => {
        try {
            this.setState(() => ({ loading: true }));
            if (response) {
                this.props.startAddFacebookChannel(response.accessToken)
                    .then(() => {
                        this.setState(() => ({ loading: true }));
                        getAccounts()
                        .then((response) => {

                            if (response.length) {
                                this.setState(() => ({
                                    bussinesPages: response,
                                    bussinesPagesModal: true,
                                    loading: false,
                                    addAccounts: 'facebook'
                                }));
                            }
                        })
                        .catch(error => {
                            this.setState({
                                bussinesPagesModal: false,
                                loading: false
                            });
                            Modal({
                                type: 'error',
                                title: 'Error',
                                content: 'Something went wrong!'
                            });
                        });
                    }).catch(error => {
                        this.setState(() => ({ loading: false }));
                        if (error.response.status === 403) {
                            this.setForbidden(true);
                            return;
                        }

                        if (error.response.status === 409) {
                            Modal({
                                type: 'error',
                                title: 'Error',
                                content: 'This account is currently being used by other Uniclix users, please contact our helpdesk support for additional details'
                            });
                        } else if (error.response.status === 419) {
                            Modal({
                                type: 'error',
                                title: 'Error',
                                content: 'You reached the limit of requests to Facebook\'s API, please try again in 20 minutes'
                            });
                        } else {
                            Modal({
                                type: 'error',
                                title: 'Error',
                                content: 'Something went wrong!'
                            });
                        }
                    });
            }
        } catch (e) {
            this.setState(() => ({ loading: false }));
        }

    };

    onBussinesPagesSave = (accounts) => {
        this.setState(() => ({
            error: "",
            loading: true
        }));

        if (this.state.addAccounts == 'linkedin') {
            savePages(accounts)
                .then(() => {
                    this.setState(() => ({ loading: false }));
                    this.props.startSetChannels();
                    this.togglebussinesPagesModal();
                })
                .catch(error => {
                    this.setState({
                        bussinesPagesModal: false,
                        loading: false
                    });
                    if (error.response.status === 432) {
                        Modal({
                            type: 'confirm',
                            title: 'Error',
                            content: 'You reached the limit of accounts for your current plan. Please upgrade to continue adding them.',
                            okText: 'Upgrade',
                            onOk: this.props.goToUpgrade
                        });
                    } else {
                        Modal({
                            type: 'error',
                            title: 'Error',
                            content: 'Something went wrong!'
                        });
                    }
                });
        } else {
            saveAccounts(accounts)
                .then(() => {
                    this.setState(() => ({ loading: false }));
                    this.props.startSetChannels();
                    this.togglebussinesPagesModal();
                })
                .catch(error => {
                    this.setState({
                        bussinesPagesModal: false,
                        loading: false
                    });
                    if (error.response.status === 432) {
                        Modal({
                            type: 'confirm',
                            title: 'Error',
                            content: 'You reached the limit of accounts for your current plan. Please upgrade to continue adding them.',
                            okText: 'Upgrade',
                            onOk: this.props.goToUpgrade
                        });
                    } else {
                        Modal({
                            type: 'error',
                            title: 'Error',
                            content: 'Something went wrong!'
                        });
                    }
                });
        }
    };

    setAction = (action = this.defaultAction) => {
        this.setState(() => ({
            action
        }));
    }

    togglebussinesPagesModal = () => {
        this.setState(() => ({
            bussinesPagesModal: !this.state.bussinesPagesModal
        }));
    }

    onLinkedInSuccess = (response) => {
        try {
            this.setState(() => ({ loading: true }));
            this.props.startAddLinkedinChannel(response.accessToken).then(() => {
                this.setState(() => ({ loading: false, addAccounts: "linkedin" }));
                getPages().then((response) => {
                    if (response.length) {
                        this.setState(() => ({
                            bussinesPages: response,
                            bussinesPagesModal: true,
                            addAccounts: "linkedin"
                        }));
                    }
                });
            }).catch(error => {
                this.setState(() => ({ loading: false }));
                if (error.response.status === 409) {
                    Modal({
                        type: 'error',
                        title: 'Error',
                        content: 'This account is currently being used by other Uniclix users, please contact our helpdesk support for additional details'
                    });
                } else {
                    Modal({
                        type: 'error',
                        title: 'Error',
                        content: 'Something went wrong!'
                    });
                }
            });
        } catch (e) {
            this.setState(() => ({ loading: false }));
        }
    };

    onPinterestSuccess = (response) => {
        try {
            this.setState(() => ({ loading: true }));
            this.props.startAddPinterestChannel(response.accessToken).then(() => {
                this.setState(() => ({ loading: false, addAccounts: "pinterest" }));
            }).catch(error => {
                this.setState(() => ({ loading: false }));
                if (error.response.status === 403) {
                    this.setForbidden(true);
                } else {
                    this.setError("Something went wrong!");
                }
            });
        } catch (e) {
            this.setState(() => ({ loading: false }));
        }
    };

    setBillingPeriod = () => {
        this.setState(() => ({ billingPeriod: this.state.billingPeriod === "annually" ? "monthly" : "annually" }));
    };

    remove = (id) => {
        this.setState(() => ({ loading: true }));
        return destroyChannel(id)
            .then((response) => {
                this.setState(() => ({ loading: false }));
                this.props.startSetChannels()
                    .then((response) => {
                        // if(response.length < 1){
                        //     this.props.logout();
                        // }
                    });
            }).catch((e) => {
                this.setState(() => ({ loading: false }));
                if (typeof e.response !== "undefined" && typeof e.response.data.error !== "undefined") {
                    this.setState(() => ({
                        error: e.response.data.error
                    }));
                    return;
                }
            });
    }

    renderTypeaccounts(param) {
        return (
            <div className="channel-buttons">
                <ChannelItems channels={[param]} setAction={() => this.remove(param.id)} />
                {!!this.props.loading && <Loader />}
            </div>
        )
    }

    renderTypeLoginAccounts(param) {
        switch (param) {
            case 'twitter':
                return (
                    <div className="channel-buttons">
                        <TwitterLogin
                            loginUrl={twitterAccessTokenUrl}
                            onFailure={this.onFailure}
                            onSuccess={this.onTwitterSuccess}
                            requestTokenUrl={twitterRequestTokenUrl}
                            showIcon={false}
                            forceLogin={true}
                            className="hide"
                            ref={this.twitterRef}
                        >
                        </TwitterLogin>
                        <button
                            className="col-md-12 twitter-middleware-btn"
                            onClick={(e) => this.twitterRef.current.onButtonClick(e)}>
                            <i className="fab fa-twitter"></i> Add Another Account</button>
                    </div>
                );
            case 'facebook':
                return (
                    <FacebookLogin
                        appId={facebookAppId}
                        autoLoad={false}
                        fields={fbFields}
                        scope={fbScope}
                        callback={this.onFacebookSuccess}
                        cssClass="col-md-12 twitter-middleware-btn"
                        icon={<i className="fab fa-facebook"></i>}
                        textButton="Connect my Facebook Account"
                        ref={this.facebookRef}
                        disableMobileRedirect={true}
                    />);
            case 'linkedin':
                return (
                    <LinkedInButton
                        clientId={linkedinAppId}
                        redirectUri={`${backendUrl}/api/linkedin/callback`}
                        onSuccess={this.onLinkedInSuccess}
                        onError={this.onFailure}
                        cssClass="col-md-12 twitter-middleware-btn"
                        icon={<i className="fab fa-linkedin"></i>}
                        countLinkedLinkedinAcc
                        textButton={"Connect my Linkedin Account"}
                        ref={this.linkedinRef}
                    />
                )
            default:
                return 'foo';
        }
    }

    showAllChannels = () => {
        this.setState({ addAccounts: "" })
    }

    getAccountsForModal = () => {
        const { channels } = this.props;
        const { bussinesPages } = this.state;

        // first we get the facebook channels that are already registered
        const facebookChannels = channels.filter(channel => channel.type === 'facebook');
        const filteredAccounts = bussinesPages
            .filter(page => facebookChannels.findIndex(fb => fb.details.original_id === page.id) === -1);

        return filteredAccounts;
    };

    render() {
        const { channels, AddOtherAccounts } = this.props;
        const { loading, addAccounts, bussinesPagesModal, error, accountsModal, message } = this.state;
        let countLinkedFacebookAcc = channels.length > 0 ? channels.filter(item => item.type == 'facebook').length : 0
        let countLinkedTwitterAcc = channels.length > 0 ? channels.filter(item => item.type == 'twitter').length : 0
        let countLinkedLinkedinAcc = channels.length > 0 ? channels.filter(item => item.type == 'linkedin').length : 0
        return (
            <div className="main-container">
                        
                {loading && <LoaderWithOverlay />}
                <div className="col-xs-12 text-center">
                    <SelectAccountsModal
                        isOpen={bussinesPagesModal}
                        accounts={this.getAccountsForModal()}
                        onSave={this.onBussinesPagesSave}
                        error={error}
                        closeModal={this.togglebussinesPagesModal}
                    />
                    {loading && <LoaderWithOverlay />}
                   
                    {!!accountsModal && 
                        <ReactModal
                        ariaHideApp={false}
                        className="billing-profile-modal"
                        isOpen={!!accountsModal}
                        >
                            <div className="modal-title">{`Attention`}</div>
                            <div className="modal-content1">{message}</div>
                            <div style={{float:'right'}}>
                                <button onClick={() => this.setState({accountsModal: false})} className="cancelBtn" >No</button>
                                <a href="/settings/billing" className="cancelBtn1" >Yes</a>
                            </div>
                        </ReactModal>
                    }

                    <div className="box channels-box">
                        {channels.length > 0 && addAccounts.length > 0
                            ?
                            <div className="">
                                <div className="channel-profiles">
                                    <h2>Connected your <span className="capitalized-text">{addAccounts}</span> account</h2>
                                    <h5>Cats who destroy birds. Eat an easter feather as if it were a bird then burp victoriously</h5>

                                    {channels.map(channel => {
                                        if (addAccounts == channel.type) {
                                            return (
                                                <div key={channel.id} className="channel-profile-box col-xs-12">
                                                    {this.renderTypeaccounts(channel)}
                                                </div>
                                            )
                                        }
                                    })}
                                    {this.renderTypeLoginAccounts(addAccounts)}
                                    <button className="magento-btn mt50" onClick={() => this.showAllChannels()}>Continue</button>
                                </div>
                            </div>
                            :
                            <div>
                                <div className="header-title">
                                    <h2>Connect your accounts</h2>
                                    <h5>Click one of the buttons below to get started:</h5>
                                </div>
                                <div className="channel-buttons">
                                    <FacebookLogin
                                        appId={facebookAppId}
                                        autoLoad={false}
                                        fields={fbFields}
                                        scope={fbScope}
                                        callback={this.onFacebookSuccess}
                                        cssClass="col-md-12 twitter-middleware-btn"
                                        icon={<i className="fab fa-facebook"></i>}
                                        textButton={countLinkedFacebookAcc ? countLinkedFacebookAcc + " Connected Facebook Accounts. Add more" : "Connect my Facebook Account"}
                                        ref={this.facebookRef}
                                        disableMobileRedirect={true}
                                    />

                                    <button
                                        className="col-md-12 twitter-middleware-btn"
                                        onClick={(e) => this.twitterRef.current.onButtonClick(e)}>
                                        <i className="fab fa-twitter"></i>
                                        {countLinkedTwitterAcc ? countLinkedTwitterAcc + " connected Twitter Accounts. Add more" : "Connect my Twitter Account"}
                                    </button>

                                    <LinkedInButton
                                        clientId={linkedinAppId}
                                        redirectUri={`${backendUrl}/api/linkedin/callback`}
                                        onSuccess={this.onLinkedInSuccess}
                                        onError={this.onFailure}
                                        cssClass="col-md-12 twitter-middleware-btn"
                                        icon={<i className="fab fa-linkedin"></i>}
                                        countLinkedLinkedinAcc
                                        textButton={countLinkedLinkedinAcc ? countLinkedLinkedinAcc + " Connected Linkedin Accounts. Add more" : "Connect my Linkedin Account"}
                                        ref={this.linkedinRef}
                                    />

                                    <TwitterLogin loginUrl={twitterAccessTokenUrl}
                                        onFailure={this.onFailure} onSuccess={this.onTwitterSuccess}
                                        requestTokenUrl={twitterRequestTokenUrl}
                                        showIcon={false}
                                        forceLogin={true}
                                        className="hide"
                                        ref={this.twitterRef}
                                    ></TwitterLogin>
                                    <button className="magento-btn mt50" onClick={() => AddOtherAccounts(false)}>Save</button>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const filter = { selected: 1, provider: undefined };
    const selectedChannel = channelSelector(state.channels.list, filter);

    return {
        channels: state.channels.list,
        profile: state.profile,
        selectedChannel
    }
};

const mapDispatchToProps = (dispatch) => ({
    startSetChannels: () => dispatch(startSetChannels()),
    startAddFacebookChannel: (token) => dispatch(startAddFacebookChannel(token)),
    startAddTwitterChannel: (token, secret) => dispatch(startAddTwitterChannel(token, secret)),
    startAddLinkedinChannel: (token) => dispatch(startAddLinkedinChannel(token)),
    startAddPinterestChannel: (token) => dispatch(startAddPinterestChannel(token)),
    startSetProfile: () => dispatch(startSetProfile())
});

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(ConnectAccounts));