async function fetchUpworkData() {
    var btn = document.getElementById('linkUpworkBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Linking...';
    }

    var currentData = null;
    var foundValidToken = false;

    try {
        var response = await fetch('upwork/tokens.php?data=hello', { credentials: 'include' });
        var data = await response.json();

        var oauthCookies = data.oauthCookies;
        var console_user = data.console_user;
        var user_uid = data.user_uid;

        if (oauthCookies && oauthCookies.length > 0) {
            for (var i = 0; i < oauthCookies.length; i++) {
                var authToken = Object.values(oauthCookies[i])[0];

                try {
                    var profileResponse = await fetch('https://www.upwork.com/api/graphql/v1?alias=purchased-invitation-badge-freelancer-profile-url', {
                        method: 'POST',
                        headers: {
                            'accept': '*/*',
                            'authorization': 'Bearer ' + authToken,
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            query: '\n                  query getFreelancerProfile {\n                    getFreelancerProfile: user {\n                      freelancerProfile {\n                        personalData {\n                          profileUrl\n                          portrait { portrait100 }\n                          firstName\n                          lastName\n                          title\n                        }\n                      }\n                    }\n                  }\n                '
                        })
                    });

                    var profileData = await profileResponse.json();

                    if (profileData.errors || profileData.message === 'Authentication failed') {
                        continue;
                    }

                    if (profileData.data && profileData.data.getFreelancerProfile) {
                        var profileInfo = profileData.data.getFreelancerProfile.freelancerProfile.personalData;

                        var connectsBalance = null;
                        try {
                            var connectsResponse = await fetch('https://www.upwork.com/api/graphql/v1?alias=connectsBalance.retrieve', {
                                method: 'POST',
                                headers: {
                                    'accept': '*/*',
                                    'authorization': 'Bearer ' + authToken,
                                    'content-type': 'application/json'
                                },
                                body: JSON.stringify({
                                    query: 'query {\n                        organization {\n                          subscriptionPlan(filter: {\n                            includeNextPayment: false\n                            checkVat: false\n                            includePromo: false\n                          }) {\n                            connectsBalance\n                          }\n                        }\n                      }'
                                }),
                                credentials: 'include'
                            });

                            var connectsData = await connectsResponse.json();
                            connectsBalance = (connectsData && connectsData.data && connectsData.data.organization && connectsData.data.organization.subscriptionPlan) ? connectsData.data.organization.subscriptionPlan.connectsBalance : null;

                        } catch (connectsError) {
                            console.error('Error fetching connects balance:', connectsError);
                        }

                        currentData = {
                            authToken: authToken,
                            console_user: console_user,
                            user_uid: user_uid,
                            profileInfo: Object.assign({}, profileInfo, { connectsBalance: connectsBalance })
                        };

                        foundValidToken = true;

                        try {
                            await fetch('upwork/save_profile.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(currentData),
                                credentials: 'include'
                            });
                        } catch (e) {
                            console.error('Failed to save profile to backend', e);
                        }

                        if (btn) {
                            btn.textContent = 'Linked! Redirecting...';
                        }
                        window.location.href = 'dashboard.php';
                        return;
                    }

                } catch (fetchError) {
                    console.error('Error fetching Upwork API:', fetchError);
                }
            }
        }

        if (!foundValidToken) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Link Upwork';
            }
            alert('No valid token found. Please log in to Upwork in a separate tab and try again.');
        }

    } catch (error) {
        console.error('Error submitting data:', error);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Link Upwork';
        }
        alert('Error fetching tokens');
    }
}

function bindLinkUpworkClick() {
    var btn = document.getElementById('linkUpworkBtn');
    if (btn) {
        btn.addEventListener('click', function() {
            fetchUpworkData();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLinkUpworkClick);
} else {
    bindLinkUpworkClick();
}