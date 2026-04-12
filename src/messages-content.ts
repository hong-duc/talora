export interface MessageThread {
	id: string;
	sender: string;
	avatar: string;
	listTime: string;
	sentAt: string;
	via: string;
	subject?: string;
	preview: string;
	important?: boolean;
	contentIntro: string;
	content: string[];
	signoff: string;
	signatureTitle: string;
	attachmentName: string;
	attachmentSize: string;
}

export const messageThreads: MessageThread[] = [
	{
		id: 'd7f4f6c2-9b47-4f86-b7e1-31f8c8a9ef10',
		sender: 'The Librarian',
		avatar:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuDCsIS07ZmjqZN7fXoWKFQbecqEKYuFh4Hz-CtC8_Q5WLLbX6RPgViAj8kljxOR_Ab-XLBVmmLIXROilaBorpvMSHngIfNp4AVL5gIlb4gk0hO6yS1VjW3AJtecWvLcG-Ggj1aW3h1jWNtVGbXVp3hqoOXU3uKnUULl8z3-i2v9f_seZSKd6blLW-BZhnxpPBSVn89Jpu75At_5ECO_VX1UN6Fq4tNcbVdPoosBD2P0gMHhWkG8EGWVuVBu8SDdOJ_Fca5bGbrcfq4',
		listTime: '14:22 PM',
		sentAt: 'October 24, 14:22 PM',
		via: 'Sent via Grand Archive Registry',
		subject: 'Urgent: The Seal of Silence',
		preview:
			'The ancient seal has been broken in the North Wing. We must act quickly before the echoes escape into the mundane world...',
		important: true,
		contentIntro: '"Keeper of the Last Flame, hear this warning."',
		content: [
			'The seal chamber beneath the North Wing has fractured. For the first time in generations, the whispers sealed by the Elder Circle have begun pressing against the wards.',
			'You must gather three warding relics before moonrise: the Obsidian Pin, the Silver Ink, and the Seventh Candle. Without them, the fracture will widen and memory itself may leak into false timelines.',
			'Rendezvous at the Spiral Stair after dusk. Bring no companions unless they bear a sanctioned sigil.'
		],
		signoff: 'In silence and vigilance,',
		signatureTitle: 'The Librarian, Warden of Seals',
		attachmentName: 'Seal_Status_Report.arc',
		attachmentSize: '1.8 Mana'
	},
	{
		id: '920184',
		sender: 'Echo of Elara',
		avatar:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuBp0zpP1ICCmtNcjOFG5H5coe9TDNLVdL5J2ZxjdyjG0qxpyyo63Ak-w0I6eKvXJKcxtgeC45jwPThBf1b1hpZkUyGJgvEuR0j-G2dqmdA9HYlfHxNJLAcFRhq8DioFqZja5ZZM1dnLh7LL-X5kX7XHXiXqo8b5zPSMiRSJm97r6cu5Y8aLwnD9-PQSnxMYDjL6pLgYLT_pUxbUv1_G3_PGHFt0TH4LGzeGrhbW8DVzj2hM6Ys6qRnNfJKrGHHSJZz1AOeyhUTn2Ew',
		listTime: 'Yesterday',
		sentAt: 'October 23, 19:10 PM',
		via: 'Echo projection',
		preview:
			'I found the lost manuscript you were asking about. It was hidden behind the shelf of Forgotten Dreams. Meet me at dusk near the fountain...',
		contentIntro: '"Your request reached me like starlight through dust."',
		content: [
			'I traced the resonance of your query to the Forgotten Dreams shelf and found a false spine concealing a narrow compartment.',
			'Inside was the manuscript, wrapped in weathered silk and marked with a crescent sigil. The pages are intact, but the margins move if stared at too long.',
			'Meet me at dusk by the fountain and I will pass it to you in person.'
		],
		signoff: 'Until dusk,',
		signatureTitle: 'Echo of Elara',
		attachmentName: 'Dream_Shelf_Map.sketch',
		attachmentSize: '0.7 Mana'
	},
	{
		id: 'f5a93e72-1b6e-45fd-a72d-0f29f5230b6a',
		sender: 'Master Chronos',
		avatar:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuBAeP9dQLV2hZ0LdWceEwS3KaLcTwKSieKzAkhc_gVPYa8w7UKh_06ArtTjOIMzamn7FJLp_xHEAFfquB92kE-_ufGPXwJq03BiJ0u-MDlu8WTVNh8l6EuQ1YGgfDtlkh3irvv9FXKNSdJW2WZnm-hbNr2Sji1amiCSoEO87ObxyP-C0sTG5UdFQs8pubtqtd86OMSxK8eFzle206oCGaFmCagDdpM6fIbs0pncC0QooA3z3xnFWeSpxSPrtGZTjuHmMDB9Hfj-KZA',
		listTime: '2 days ago',
		sentAt: 'October 22, 12:45 PM',
		via: 'Sent via Astral Plane',
		preview:
			'Time is a fickle thing in this library. Do not trust the clocks in the Reading Room, they have begun to run backwards again...',
		contentIntro: '"Greetings, Keeper of the Eternal Sands..."',
		content: [
			'I have observed a tremor in the fabric of the Great Archive. The scrolls dated from the Third Era are beginning to shimmer with an unnatural light.',
			'You must ensure the library doors are sealed with the Violet Sigil before the twin moons reach their zenith. Failure may result in temporal leakage that rewrites protected histories.',
			'Bring the Obsidian Lens to the spire tonight. We have much to discuss before the first echo fades.'
		],
		signoff: 'May time treat you kindly,',
		signatureTitle: 'Master Chronos, Head Chronomancer',
		attachmentName: 'Temporal_Sigil.mag',
		attachmentSize: '2.4 Mana'
	},
	{
		id: '774203',
		sender: 'The Archivist',
		avatar:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuCB651vJcvZdw5_zyLXpqRtArwBgkmHVgyzJmeI-sYxeXHfId6pllJ1WVW0VcC-II2buxyWbc3J5wjJBkQA9hq0vXfWZE8S3Rj1GGyys0yqtGK37JF1F7FtpZD3AMY0ASraF1apO2qDhIl1vGveWkyuycN7BhiCKRpunyXKB2m6vdRshhPxKuieHFRviB6eOIsPWzZ9Iyxj9bAtpb6TZImPIUd6sNuXKToRuX2Vkff6G0IoF8nasvb4CdDrcOa4leb9ffmzapQ_Qxk',
		listTime: 'Oct 24',
		sentAt: 'October 24, 09:06 AM',
		via: 'Archive office dispatch',
		subject: 'New Collection Access',
		preview:
			'You have been granted access to the Restricted Vault. Please ensure your lantern is filled with moon-essence before entering...',
		important: true,
		contentIntro: '"By authority of the Seventh Registry,"',
		content: [
			'Your credentials have been elevated to permit supervised access to the Restricted Vault for one lunar cycle.',
			'All entries must be logged at both ingress and egress. Any borrowed tome must be returned before dawn with its ward thread intact.',
			'The western lock now recognizes your sigil. Approach only when the sentinel crystal glows violet.'
		],
		signoff: 'By seal and ledger,',
		signatureTitle: 'The Archivist, Keeper of Access',
		attachmentName: 'Vault_Access_Writ.pdf',
		attachmentSize: '1.2 Mana'
	},
	{
		id: 'c2d13274-7068-491b-a56f-c8f3440db2f1',
		sender: 'Sylas the Shadow',
		avatar:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuDWKdPpACuPJbr6d1IPqPCTTjNiqbnqFM1GSdvajNuxXtv30iaFSfquxua_y9TwWjwiOxvbPYbIfAK1vPN6uAMnmkdEupGMhVInXkQvDZz9xOBYJf7-E3a9S6Nc7w-_t9VXHZwtsq_zRvL4rG8w4IL-6y_zxvOz-p9mP6lmfW8pzUXT6LG7vY7XvEiCKIq7ouy-gjRmBn-RJqh4iXDqhy7ChoqrhTntv6ozETDCjo6jUNCAVdLdDeJFIrG4uq8u0Wpag6wt4jmvYRs',
		listTime: 'Oct 22',
		sentAt: 'October 22, 21:04 PM',
		via: 'Night courier channel',
		preview:
			'The ink you requested is ready. It\'s harvested from the deepest trenches of the Midnight Sea. Use it sparingly, for it writes its own fate...',
		contentIntro: '"Delivered as requested."',
		content: [
			'The vial has been prepared and cooled in obsidian glass. Keep it sealed unless you intend to write immediately.',
			'This ink binds intention to parchment. Hesitation will cause the script to fork into contradictions.',
			'If the page hums after writing, burn juniper and read aloud to stabilize the text.'
		],
		signoff: 'From the quiet edge,',
		signatureTitle: 'Sylas the Shadow',
		attachmentName: 'Midnight_Ink_Handling.txt',
		attachmentSize: '0.4 Mana'
	},
	{
		id: '341905',
		sender: 'Brother Thistle',
		avatar:
			'https://lh3.googleusercontent.com/aida-public/AB6AXuC4Tae1kxR24wOYx7VEucpxqCEZEFHBg6QgeIyy6v_NQ5tGLDimWqMDutMz-XgygVD--zZV4Jrx_KcPMlNLoJbjnZSm832BaHl0kDjixQQiRHKeEmoPyiC-oG0pJLPgjWU6yYtFhvX30WwPVabx3M5CtCQIhcY6nMqgGPRtB66dNSg_QNCZd20FKx-crKskYBtKoIGvdqV0M8AmA6uIG2-3ctt1nM4QK-ZvFi1oS81EjpbRpdLxtq8eQjyg_iyeTcNKLGVpyevlap0',
		listTime: 'Oct 20',
		sentAt: 'October 20, 18:30 PM',
		via: 'Herbarium messenger owl',
		preview:
			'The tea is brewing in the Herbarium. Come share a cup and tell me about the strange lights you saw in the Inkwell District...',
		contentIntro: '"Friend, bring your stories and your silence."',
		content: [
			'The kettle is set and the moon-leaf blend has steeped long enough to loosen the day from your shoulders.',
			'I would hear your account of the lights in the Inkwell District before rumors twist them into superstition.',
			'Come by after evening bells. I have left the east lantern lit for you.'
		],
		signoff: 'Warmly,',
		signatureTitle: 'Brother Thistle',
		attachmentName: 'Herbarium_Note.card',
		attachmentSize: '0.2 Mana'
	}
];
