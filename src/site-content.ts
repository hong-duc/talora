export const indexContent = {
	hero: {
		titleLeading: 'Enter The',
		titleHighlight: 'Whispering Library',
		description:
			'Where every choice carves a new destiny amidst floating books and glowing crystals. Your story is waiting to be written.',
		image: '/hero-library.png',
		imageAlt: 'Mystical library interior with floating books and glowing crystals',
		primaryCta: 'Begin Your Journey',
		secondaryCta: 'View Lore'
	},
	legendSection: {
		title: 'Forge Your Own Legend',
		description:
			'Discover a world where the stories breathe and react to your every decision. No two adventures are ever the same.',
		cards: [
			{
				icon: 'alt_route',
				title: 'Choose Your Path',
				description:
					'Your decisions shape the narrative. From simple dialogues to world-altering choices, determine your ultimate fate.'
			},
			{
				icon: 'auto_fix_high',
				title: 'Magical Realms',
				description:
					'Travel through enchanted forests, celestial cities, and forgotten ruins. Each realm holds its own secrets and dangers.'
			},
			{
				icon: 'groups',
				title: 'Community Lore',
				description:
					'Share your unique adventures and contribute to the ever-growing collective history of the Library.'
			}
		]
	},
	featuredStories: {
		title: 'Featured Stories',
		subtitle: 'Curated tales for the brave',
		viewAllLabel: 'View All',
		cards: [
			{
				genre: 'Mystery',
				title: 'The Gilded Grimoire',
				description: 'Discover the secrets of the ancient alchemy...',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuAbKNnOpcKV60QkSR8UYCKMjs7Vs8zp3iw3Mu4PtbZp1KSFW17jEtTeYNdvE7_BlKSOEcticDlQJMCKJGoKegaLtoJ1lBnu8E4SXsIUrXGb9q8WAIKzuOrRx2NLb-rWsM9EPfvsbMWqGJg_6jcRJtVMNEZsgyLBDpbtVGk2WOg1n6_jJntgx6ZR14KX_m0OR6QFzOFZXxiPb-X3weyKxsfj7Cld3u701lb-AAE7HNNsArgvO9A369JqKNsO0kNJYEphf_nHSub_w-A'
			},
			{
				genre: 'Fantasy',
				title: 'Echoes of the Void',
				description: 'A journey beyond the stars of Eldoria...',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuDRCVDykQUEEXB4etLZF1xRjj03Ob87xs2koweKzEfXmPYDYXLI4V28XL1jhLZblkq4ys-CDT4AFrdRfEqfoi8BqIWEdxRvBELD46JFl-82T2genkK-Gjzh22No62_1LU12BuQ0EmuaM_GNYJ6g8wi7-F5LMa0wNRZ0TbFRLMcpIa-1qj2qGdcnxY7aRkZNVgWhtWKgxEwi_CLtmp4P3gVqtNv9hD8duDy3KX136g_uGCSfrvCKRW7_HLnar0STXloBBp4R-I9Z6pE'
			},
			{
				genre: 'Quest',
				title: "The Alchemist's Secret",
				description: 'The recipe for immortality comes at a price...',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuCmQnvbVkFtvcse-gDyS3CCm1L-BYDnpoIddkF6k-s7HUalyB2N4A_m_OFBUQrTx-6m7NTixcgt_cGqg6Rek9yG1DBVom5A3wc9LfwF9716526t0Y6L8puNr6rRJlRLNsxKllSMXdh7F8jbbuc5hRKVWrBK59-G4K1vC_78ywEeiD607g4YJb8xr6CkEBXgJWfuWaLSi_gFGu75v99pPYKtovo9DPxyUs4IZZRKWhpDQ9T0pgZcuyxrbs7vUS1VBKUOz4YUxtWTxns'
			},
			{
				genre: 'Horror',
				title: 'Shadows of Eldoria',
				description: 'When the sun sets, the shadows awaken...',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuAWJQtp7aQsv7jHF7w4tFgXEuBVpawrlijdXbbFF-Ft_oaIMEgQu9WG_BeL63XxxHzOYMjnbD1E2SQPd9t6thrSJQdPPBDlHL5Vqiwg4IIKIegKzu9nf9faJynbly2ec8rNugcL56K5gobGBIDB1sWlzw9qrSbAj3zUnAayr3uy0u1WldIoSNswDJDkXtDDPW1ZjHtn-y10xsPvQru0GDCpw36C_PbUhv72IjTb1gnW5uhMYo_gp0I-g5qWSHzR7-lKeiMETObwmsA'
			}
		]
	}
} as const;

export const archiveContent = {
	hero: {
		title: 'The Great Archive',
		image: '/hallway.png',
		searchPlaceholder: 'Search the ancient scrolls...'
	},
	essence: {
		title: 'Browse by Essence',
		categories: [
			{ icon: 'all_inclusive', label: 'All Scrolls', active: true },
			{ icon: 'mystery', label: 'Mystery', active: false },
			{ icon: 'castle', label: 'Fantasy', active: false },
			{ icon: 'skull', label: 'Horror', active: false },
			{ icon: 'explore', label: 'Quest', active: false }
		]
	},
	recentlyUncovered: {
		title: 'Recently Uncovered',
		viewAllLabel: 'View all scrolls',
		cards: [
			{
				title: "The Weaver's Echo",
				description:
					"In a world where sound can shape reality, a deaf apprentice discovers an ancient resonance that could silence the world forever.",
				authorInitials: 'E.V.',
				authorName: 'Elara Vox',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuB5lILRl4iZPTKLvf64Sr7Rf53KhNwxtEn_v0f24Gmcbme-1K28qmm0CfIQZpj22TnPGJ3ZCCeJn1mxFKCApadLCeaCBM__t_Fo9T56dQn8x1PwQBNINqVrWiAL1yiSenTcAHloL4Yurpm1oS5d28lhwezkWd61VXi2Kl8NUO4ZsLFer0KqmE52-4t18RzMjJknQK7GVENfSHmIm8MjMsfFbvN7xn7RJ7GD5w_AhlKsWXZFGvfvR7Zuc4O8NI6psiirAB1SPhe4SNY',
				genre: 'Fantasy',
				genreBadgeClass: 'bg-primary/80',
				chapters: '12 Chapters'
			},
			{
				title: 'Midnight at Frostpeak',
				description:
					"A detective with the ability to see the last five minutes of a victim's life is called to a remote mountain observatory.",
				authorInitials: 'M.S.',
				authorName: 'Mordecai Stone',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuBwKe5caddICnM3Tt42aPVeAVbYIBpFvnaVYb2hhrFPvpDhGJECbFJmLLNRzh-dBp6JVf7m264nQslmzUwYhLkgjfypD9jt3SYdZ2zMldPaUWbHd7evlrJvnyC3VcvWVaecNSG8H8FcdoIjIL1QIX8-g3aBaIoP0R-IP8QjuPot4esRllxCYg9Y6f3LI_4xO2bSsnDX1MzrtR23W385RXj2cCuHdQig68R0lri_JJwWp-fw1Wg9OJoI9UUyGH6hGOIHUiIiczZrDEc',
				genre: 'Mystery',
				genreBadgeClass: 'bg-indigo-600/80',
				chapters: '8 Chapters'
			},
			{
				title: 'The Shadow Collector',
				description:
					'In the city of Aethelgard, your shadow is your soul. But someone has started stealing them, leaving behind hollow husks.',
				authorInitials: 'L.N.',
				authorName: 'Lilith Night',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuBFHemj2HtWosyfAZgM44eZnbQ2SylUxA-fz6pqsrujnLcZB4y7ziRzY3KW-POI1TME1L7zOQp_6fUCXdToKGMo12GOg7FVJJ8CdFb5c9erYR8wTN02H6NN8m2dOusJoAmHbXRet96-UNWncpzfGCneXTj5dMlZOx0JTIQ3HiWPC_7yElGpE_2gN6iN1ChWN-7z8guKYH2PcrIWVYK9Ujkujj1rKekOcXdORW10KNJYQoggPmlpq2xFpeD0Amd-SK4eJ3zimxgnm4Y',
				genre: 'Horror',
				genreBadgeClass: 'bg-red-900/80',
				chapters: '15 Chapters'
			},
			{
				title: 'Beyond the Void Gate',
				description:
					'A crew of space-faring mages must navigate the Astral Sea to prevent the collapse of the celestial spheres.',
				authorInitials: 'K.S.',
				authorName: 'Kaelen Star',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuA13CtWhcvDTuFWwtCUsEah86NCUXJi_ttttAwCB5zjg9Nmq9oA1Ji42fgiBJLC_vSltOhruKMB587XTzq3c739vbwvKGfbja-m8GpXwaksjGEYo8QSyR7CmH_XPKvfENrzP1FdF9EISdq2oHjm-0GgRiaFzSbXIcjwUq7bGXqn6NcIiaJbkWaxABubFnMs_u9mjnatdQ2qlKOQgR5jn9tdMx4z-GDoxtyvJsKCnflBJ2KaWkX3EoTcjNtxSxWcgSiYyFdoJM6mSgE',
				genre: 'Quest',
				genreBadgeClass: 'bg-amber-600/80',
				chapters: '20 Chapters'
			},
			{
				title: 'The Emerald Key',
				description:
					'A hidden entrance to a forgotten civilization is found in the heart of the Amazon, guarded by living vines.',
				authorInitials: 'J.R.',
				authorName: 'Jade Rivers',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuCjWYGVHNnafgVkxscmfvR7VcC1u83Axoi88D3gdYR0Z1RKChNhmYwTuTpzw8UtL7whbLS83CA8BulUvX2MHBRGpeL_XmIrHLZ_AjLTUcxHYP9zeV7QfvLxNzDLWxDnYqdmudXVo6yZfYnmcZXg7nXn-AZYzf-a-LqsQYAgoP52IEQ9nGpxHHfBbGjcix5C5jPCHBq0vMbZzvpWIDuO1q0lLv0hCY_Co7aXFjUonI9qxu5d_zUurhT7LQt4l6Ail7gXC2xgAjUBgic',
				genre: 'Fantasy',
				genreBadgeClass: 'bg-emerald-600/80',
				chapters: '6 Chapters'
			},
			{
				title: "The Clockmaker's Secret",
				description:
					'Time is standing still in the village of Oris. The only one who can fix it is a clockmaker who vanished a century ago.',
				authorInitials: 'T.T.',
				authorName: 'Titus Tick',
				image:
					'https://lh3.googleusercontent.com/aida-public/AB6AXuDOM_tqYYb8LskUlA0GLt6wOU1w1Kz1zUYq3mk0q-2_GP0Ku-tenSWJMFAPpwuZm49dslqv8jufd-2thLcXedtI9NpwbCiQAHg069fLrmE82gvfOr5Vw8kOtf6xR6jHOtO9WbAg526LKHWt6jfhfpux5kin08uTL2pzjbrtdGlrQ9D0w55edLHLViQZH13gXXoRtt7AARBFFpiJj8M6VF9-M3Wky-BZzABF88PQ2dVwbcIpSvyDhxx1dj6yL-ePO8pQ566AVvqOafE',
				genre: 'Mystery',
				genreBadgeClass: 'bg-primary/80',
				chapters: '10 Chapters'
			}
		]
	}
} as const;
