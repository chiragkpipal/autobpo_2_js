
async function fetchProfile() {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    try {
        console.log('Fetching profile data...');

        // Fetch freelancer profile
        const profileResponse = await fetch(
            "https://www.upwork.com/api/graphql/v1?alias=purchased-invitation-badge-freelancer-profile-url", {
                headers: {
                    accept: "*/*",
                    authorization: `bearer ${upworkCreds.token}`,
                    "content-type": "application/json",
                },
                referrer: "https://www.upwork.com/nx/find-work/best-matches",
                referrerPolicy: "origin-when-cross-origin",
                body: JSON.stringify({
                    query: `query getFreelancerProfile {
                        getFreelancerProfile: user {
                            freelancerProfile {
                                personalData {
                                    profileUrl
                                    portrait {
                                        portrait100
                                    }
                                    firstName
                                    lastName
                                    title
                                }
                            }
                        }
                    }`,
                }),
                method: "POST",
                mode: "cors",
                credentials: "include",
            }
        );

        console.log('Profile response status:', profileResponse.status);

        if (!profileResponse.ok) {
            throw new Error(`Failed to fetch profile data: ${profileResponse.status}`);
        }

        const profileResult = await profileResponse.json();
        console.log('Profile result:', profileResult);

        if (!profileResult.data || !profileResult.data.getFreelancerProfile) {
            throw new Error("Invalid profile data received");
        }

        const personalData = profileResult.data.getFreelancerProfile.freelancerProfile.personalData;

        // Update profile data
        if (personalData) {
            document.getElementById('userName').textContent = `${personalData.firstName || ''} ${personalData.lastName || ''}`;
            document.getElementById('userTitle').textContent = personalData.title || 'No title available';

            if (personalData.profileUrl) {
                document.getElementById('profileLink').href = personalData.profileUrl.replace('https://upwork.com', 'https://www.upwork.com');
            }

            if (personalData.portrait?.portrait100) {
                document.getElementById('profileImage').src = personalData.portrait.portrait100;
            }
        }

        // Fetch connects balance
        try {
            const connectsResponse = await fetch(
                "https://www.upwork.com/api/graphql/v1?alias=connectsBalance.retrieve", {
                    headers: {
                        accept: "*/*",
                        authorization: `bearer ${upworkCreds.token}`,
                        "content-type": "application/json",
                    },
                    referrer: "https://www.upwork.com/nx/find-work/",
                    referrerPolicy: "origin-when-cross-origin",
                    body: JSON.stringify({
                        query: `query {
                            organization {
                                subscriptionPlan(filter: {
                                    includeNextPayment: false
                                    checkVat: false
                                    includePromo: false
                                }) {
                                    connectsBalance
                                }
                            }
                        }`,
                    }),
                    method: "POST",
                    mode: "cors",
                    credentials: "include",
                }
            );

            if (connectsResponse.ok) {
                const connectsResult = await connectsResponse.json();
                console.log('Connects result:', connectsResult);

                if (connectsResult.data?.organization?.subscriptionPlan?.connectsBalance !== undefined) {
                    const connectsBalance = connectsResult.data.organization.subscriptionPlan.connectsBalance;
                    document.getElementById('connectsBalance').textContent = connectsBalance;
                    document.getElementById('connectsBadge').style.display = 'inline-block';
                }
            } else {
                console.warn('Failed to fetch connects balance:', connectsResponse.status);
            }
        } catch (connectsError) {
            console.warn('Error fetching connects balance:', connectsError);
        }

        console.log('Profile loaded successfully');

    } catch (err) {
        console.error('Error fetching profile:', err);
        errorText.textContent = err.message;
        errorMessage.style.display = 'block';
    }
}

// Initialize profile data when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (upworkCreds && upworkCreds.token) {
        fetchProfile();
    } else {
        document.getElementById('errorText').textContent = 'Upwork credentials not found. Please link your Upwork account first.';
        document.getElementById('errorMessage').style.display = 'block';
    }
});