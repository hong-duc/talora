module HelloWorld exposing (main)

import Browser
import Html exposing (Html, button, div, h1, p, text)
import Html.Attributes exposing (class)


-- MODEL


type alias Model =
    {}


init : Model
init =
    {}



-- UPDATE


type Msg
    = NoOp


update : Msg -> Model -> Model
update msg model =
    case msg of
        NoOp ->
            model



-- VIEW


view : Model -> Html Msg
view model =
    div
        [ class """
            p-8 m-4 rounded-2xl 
            bg-gradient-to-br from-purple-50 to-indigo-100 
            border border-purple-200
            shadow-lg ethereal-glow
            max-w-2xl mx-auto
        """
        ]
        [ h1
            [ class """
                text-4xl font-bold text-primary 
                mb-4 text-center gold-shimmer
            """
            ]
            [ text "Hello from Elm! 🌿" ]
        , p
            [ class "text-lg text-gray-700 mb-6 text-center" ]
            [ text "This is an Elm component embedded in Astro using the vite-plugin-elm." ]
        , p
            [ class "text-md text-gray-600 mb-4 text-center" ]
            [ text "It's styled with Tailwind CSS and uses the project's custom theme colors." ]
        , div
            [ class "flex justify-center mt-6" ]
            [ button
                [ class """
                    px-6 py-3 bg-primary text-white 
                    rounded-lg font-semibold 
                    hover:bg-purple-800 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50
                """
                ]
                [ text "Click me (does nothing)" ]
            ]
        ]



-- MAIN


main : Program () Model Msg
main =
    Browser.sandbox
        { init = init
        , update = update
        , view = view
        }