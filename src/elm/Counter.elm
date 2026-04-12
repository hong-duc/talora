module Counter exposing (main)

import Browser
import Html exposing (Html, button, div, h2, p, span, text)
import Html.Attributes exposing (class)
import Html.Events exposing (onClick)


-- MODEL


type alias Model =
    { count : Int
    , step : Int
    }


init : Model
init =
    { count = 0
    , step = 1
    }



-- UPDATE


type Msg
    = Increment
    | Decrement
    | Reset
    | SetStep Int


update : Msg -> Model -> Model
update msg model =
    case msg of
        Increment ->
            { model | count = model.count + model.step }

        Decrement ->
            { model | count = model.count - model.step }

        Reset ->
            { model | count = 0 }

        SetStep newStep ->
            { model | step = newStep }



-- VIEW


view : Model -> Html Msg
view model =
    div
        [ class """
            p-8 m-4 rounded-2xl 
            bg-gradient-to-br from-blue-50 to-cyan-100 
            border border-blue-200
            shadow-lg
            max-w-2xl mx-auto
        """
        ]
        [ h2
            [ class """
                text-3xl font-bold text-primary 
                mb-6 text-center
            """
            ]
            [ text "Interactive Elm Counter 🔢" ]
        , div
            [ class "text-center mb-8" ]
            [ p
                [ class "text-lg text-gray-700 mb-2" ]
                [ text "Current count:" ]
            , span
                [ class """
                    inline-block text-5xl font-bold 
                    text-primary my-4 px-6 py-3 
                    bg-white rounded-xl border 
                    shadow-sm
                """
                ]
                [ text (String.fromInt model.count) ]
            ]
        , div
            [ class "flex flex-wrap justify-center gap-4 mb-8" ]
            [ button
                [ onClick Decrement
                , class """
                    px-6 py-3 bg-red-500 text-white 
                    rounded-lg font-semibold 
                    hover:bg-red-600 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50
                    min-w-[120px]
                """
                ]
                [ text ("− " ++ String.fromInt model.step) ]
            , button
                [ onClick Increment
                , class """
                    px-6 py-3 bg-green-500 text-white 
                    rounded-lg font-semibold 
                    hover:bg-green-600 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50
                    min-w-[120px]
                """
                ]
                [ text ("+ " ++ String.fromInt model.step) ]
            , button
                [ onClick Reset
                , class """
                    px-6 py-3 bg-gray-500 text-white 
                    rounded-lg font-semibold 
                    hover:bg-gray-600 transition-colors
                    focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50
                    min-w-[120px]
                """
                ]
                [ text "Reset" ]
            ]
        , div
            [ class "mt-8 pt-6 border-t border-blue-200" ]
            [ p
                [ class "text-gray-700 mb-4 text-center" ]
                [ text "Adjust step size:" ]
            , div
                [ class "flex justify-center gap-2" ]
                (List.map
                    (\stepSize ->
                        button
                            [ onClick (SetStep stepSize)
                            , class """
                                px-4 py-2 rounded-lg font-medium
                                transition-colors focus:outline-none 
                                focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                                """
                            , class
                                (if model.step == stepSize then
                                    "bg-primary text-white"

                                 else
                                    "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                )
                            ]
                            [ text (String.fromInt stepSize) ]
                    )
                    [ 1, 2, 5, 10 ]
                )
            ]
        , p
            [ class "text-sm text-gray-500 text-center mt-8" ]
            [ text "This counter demonstrates Elm's state management with local state only." ]
        ]



-- MAIN


main : Program () Model Msg
main =
    Browser.sandbox
        { init = init
        , update = update
        , view = view
        }